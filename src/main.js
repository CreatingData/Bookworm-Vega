import * as d3Fetch from 'd3-fetch';
import vegaEmbed from 'vega-embed';
import { keys } from 'd3-collection';
import 'vega-embed/vega-embed.scss';
import { timer } from 'd3-timer';
import { interpolate } from 'd3-interpolate';
import * as plots from './translators';
import { merge, set } from 'lodash-es';
import smooth from './smooth.js'
import labels from './search_limit_labels';

const counttypes = {
  "WordsPerMillion":"Uses per Million Words",
  "WordCount":"# of matches",
  "TextPercent":"% of texts",
  "TotalWords":"Total # of words",
  "TextCount":"# of Texts",
  "TotalTexts":"Total # of Texts",
  "WordsRatio":"Ratio of group A to B",
  "TextRatio":"Ratio of texts",
  "SumWords":"Total in both sets",
  "TextLength":"Mean text length (in words)",
  "MatchesPerText":"Mean hits per matching text",
  "TFIDF":"TFIDF",
  "Dunning":"Dunning Log Likelihood",
  "DunningTexts":"Dunning Log Likelihood (Text count)",
  "PMI_texts":"Pointwise Mutual Information across # of texts.",
  "PMI_words": "PMI across number of words."
}

// Keep a module-wide cache.

const definitions = {};

export default class Bookworm {

  constructor(selector, width = 600, height = 400) {
    this.selector = selector;
    this.width = width;
    this.height = height;
    this.history = [null];
    this.previous_aes = undefined;
    this.query = { 'search_limits': {} };
    this.data = [];
  }

  buildSpec(query) {
    const { data, width, height } = this;
    const type = query.plottype;
    this.spec = new plots[type](query)
      .data(this.smooth(data))
      .spec();
    this.spec.width = +width;
    this.spec.height = +height;
    this.spec = merge(this.spec, this.query.vega || {})
  }

  smooth() {
    const { query, data } = this
    if (query.smoothingSpan) {
      return smooth(
        data,
        query.smoothingSpan,
        query.aesthetic.x,
        query.counttype,
        "faussian",
        false)
    } else {
      return data
    }
  }

  render() {
    return vegaEmbed(this.selector, this.spec)
  }

  interpolateSpecs() {
    const d = 5000
    const interpolator = interpolate(this.history[1].data, this.spec.data)

    this.t = timer (elapsed => {
      let ratio = elapsed/d
      if (elapsed/d > 1) {ratio = 1}
      this.spec.data = interpolator(ratio)
      this.render()
      if (ratio === 1) {
        this.t.stop()
      }
    })

  }

  plotAPI(query, drawing = true) {
    this.query = alignAesthetic(query)
    if (drawing) {
      return bookwormFetch(query)
        .then(data => {
          this.data = data
          this.buildSpec(query)
          this.history = [this.spec, this.history[0]]
          return this.render()
        })
    }
  }

}

function validate(query) {
  // Throw errors on bad queries.
  // currently cursory
  if (!query.plottype) {throw("Must have a 'plottype' key")};
}

function bookwormFetch(query) {
  let domain = query.host || 'https://bookworm.htrc.illinois.edu'
  const newQuery = alignAesthetic(query);
  newQuery.method = newQuery.method || "data"
  newQuery.format = newQuery.format || "json_c"

  const url = encodeURI(JSON.stringify(newQuery));
  // This wrapper should only apply in an emergency, but currently
  // is always used.
  if (domain.startsWith("http:")) {
    //    domain = "https://cors-anywhere.herokuapp.com/" +  domain
  }

  return d3Fetch
    .json(`${domain}/cgi-bin/dbbindings.py?query=${url}`)
    .then( (data) => {
      const results = parseBookwormData(data.data, query)
      if (results[0]['Search'] !== undefined) {
        // More informative search labels.
        const [baseq, search_labels] = labels(query.search_limits)
        results.forEach(d => {
          d.Search = search_labels[d.Search]
        })
      }
      return results
    })
}


function alignAesthetic(query) {
  // Percolate aesthetic to 'counttypes' or 'groups' as necessary.
  query.groups = [];
  query.counttype = [];
  if (query.aesthetic) {
    keys(query.aesthetic).forEach( (key) => {
      const val = query.aesthetic[key]
      if (val === 'search_limits' ||
          val === 'Search' ||
          query.counttype.concat(query.groups).includes(val)
         ) {
        return false
      }
      if (counttypes[val] !== undefined) {
        query.counttype.push(val)
      } else {
        query.groups.push(val)
      }
    })
  }
  return query
}

function serverSideJSON(queryFull) {
  //returns only the query elements that actually matter to the server.
  //useful for seeing if the query needs to be rerun, or if all changes
  //can be handled client-side.

  var query = JSON.parse(JSON.stringify(queryFull))
  delete(query.aesthetic)
  delete(query.scaleType)
  delete(query.smoothingSpan)
  delete(query.plottype)
  delete(query.host)
  return JSON.stringify(query);

}

function parseBookwormData(data,locQuery) {
  var names = []
  var bookworm = this

  if (data instanceof Array) {

    const [baseq, labels] = labels(locQuery.search_limits)
    // You can define multiple searches;
    // Those are passed to a new index called 'search.'
    const multiples = data.map(parseBookwormData)
    
    multiples.map((search, i) => {
      search.forEach(row => {
        row['Search'] = i
      })
    })
    return multiples.reduce( (a, b) => a.concat(b))

  }

  
  const keyz = keys(data)

  const columns = keyz.map(
    k => data[k].map(
      // Test by properties if it's an array 
      d => d.reduceRight ?
        // If so, unroll it using the first (integer) key as the run-length.
        Array(d[0] + 1).fill(d[1]):
        // otherwise, 
        d
    )
    // flatten out the nested lists.
      .flat()
  )

  let results = columns[0]
    .map((x, i) => {
      const row = {};
      keyz.forEach((k, j) => {
        row[k] = columns[j][i]
      })
      return row;
    })


  results = add_href(results, locQuery)

  return results
}


function add_href(data, locQuery) {
  
  const query = JSON.parse(serverSideJSON(locQuery))
  
  query['method'] = 'search';
  query['format'] = 'html';
  
  return data
    .map(row => {
      
      // This could be more dynamic; currently, just
      // open a search in a new window.
      query.groups.forEach( g => {
        query['search_limits'][g] = [row[g]]
      })
      
      const query_string = encodeURI(JSON.stringify(query))
      
      row['href'] = `${locQuery.host}/cgi-bin/dbbindings.py?${query_string}`
      
      return row
    })
  return results
}

function toObject(names, values) {
  // A hack against the way the json format
  // loses type information.
  var result = {};
  for (var i = 0; i < names.length; i++) {
    if (names[i].endsWith("_year") || names[i].endsWith("_month")) {
      values[i] = `${parseInt(values[i])}`
    }
    result[names[i]] = values[i];
  }
  return result;
};

//run flatten initially with nothing prepended: as it recurses, that will get filled in.
try {
  var flat = flatten(json);
} catch(err) {
  var flat = []
}

window.bookworm_search = function(json) {

  //add the labels.

}
