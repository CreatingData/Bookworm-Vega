import * as d3Fetch from 'd3-fetch';
import vegaEmbed from 'vega-embed';
import { keys } from 'd3-collection';
import 'vega-embed/vega-embed.css';

const counttypes = {"WordsPerMillion":"Uses per Million Words","WordCount":"# of matches","TextPercent":"% of texts","TotalWords":"Total # of words","TextCount":"# of Texts","TotalTexts":"Total # of Texts","WordsRatio":"Ratio of group A to B","SumWords":"Total in both sets","TextLength":"Mean text length (in words)","MatchesPerText":"Mean hits per matching text","TFIDF":"TFIDF","Dunning":"Dunning Log Likelihood","DunningTexts":"Dunning Log Likelihood (Text count)"}

export default class Bookworm {
  constructor(selector, width = 600, height = 400, api) {
    this.selector = selector;
    this.width = width;
    this.height = height;
    this.previous = undefined
    this.query = {'search_limits':{}};
      
  }


  plotAPI(query) {
    const aligned = alignAesthetic(query);
    return bookwormFetch(query)
      .then(data => {
        const spec = specify(data, query)
          console.log(spec);
        return (vegaEmbed(this.selector, spec))
      })

  }

  embedVegaSpec() {
    var spec = "https://raw.githubusercontent.com/vega/vega/master/docs/examples/bar-chart.vg.json";
    vegaEmbed(this.selector, spec).then(function(result) {

    })
  }
}

function validate(query) {
    // Throw errors on bad queries.
    if (!query.plottype) {throw("Must have a 'plottype' key")};
}

function specify(data, query) {
  // Turn Bookworm queries into Vega-lite specs.
  if (query.plottype === 'pointchart') {
    return {
      width:640, height:400,
      data: {values: data},
      "mark": {"type": "circle","size":120},
      "encoding": {
        "y": {
          "field":query.aesthetic.y, "type": "nominal",
          "sort":{"op":"mean", "field": query.aesthetic.x, "order":"descending"}
        },
        "color": {
          "field": query.aesthetic.color, "type": "nominal"
        },
        "x": {
          "field":query.aesthetic.x, "type":"quantitative"
        }
      }
    }
  }
}

function bookwormFetch(query) {
  let domain = query.host || 'https://bookworm.htrc.illinois.edu'
  const newQuery = alignAesthetic(query);
  const url = encodeURI(JSON.stringify(newQuery));
  // This wrapper should probably only apply in an emergency.
  if (domain.startsWith("http:")) {
    domain = "https://cors-anywhere.herokuapp.com/" +  domain
  }
  return d3Fetch.json(`${domain}/cgi-bin/dbbindings.py?query=${url}`).then(
    data => parseBookwormData(data.data, query))
}


function alignAesthetic(query) {
  // Percolate aesthetic to 'counttypes' or 'groups' as necessary.
  console.log(query);
  query.groups = [];
  query.counttype = [];
  if (query.aesthetic) {
    keys(query.aesthetic).forEach( (key) => {
      const val = query.aesthetic[key]
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
    delete(query.plotType)
    return JSON.stringify(query);

}

function parseBookwormData(json,locQuery) {
  // Changes the shape of the hierarchical json the API
  // delivers to a flat one with attribute names
  // which takes more space but plays more nicely with d3/javascript.
  var names = []
  var bookworm = this

  if (json instanceof Array) {
    //
    const newOut = {};
    json.forEach( (d, i) => {
      newOut[i] = d
    })
      json = newOut
    names.push("search_limits")
  }

  names = names.concat(locQuery.groups).concat(locQuery.counttype);

  function flatten(hash,prepend) {
    prepend = prepend || [];
    var results = Object.keys(hash).map(function(key) {
      var newpend = prepend.concat(key)
        if (hash[key] instanceof Array)
      {
        return(newpend.concat(hash[key]))
      }
      else {
        var vals = flatten(hash[key],newpend)
          //is this doing anything different from return (vals)?
          return(
            vals.map(function(array) {
              return(array)
            })
          )
      }
    })

      if (results[0][0] instanceof Array) {
        return(results.reduce(function(a,b){return(a.concat(b))}))
      } else {
        return(results)
      }
  }

  function toObject(names, values) {
    var result = {};
    for (var i = 0; i < names.length; i++) {
      result[names[i]] = values[i];}
    return result;
  };

  //run flatten initially with nothing prepended: as it recurses, that will get filled in.
  try {
    var flat = flatten(json);
  } catch(err) {
    var flat = []
  }
  //add the labels.
  var results = flat.map(function(localdata){
    return(toObject(names,localdata));
  })

    return(results)

}
