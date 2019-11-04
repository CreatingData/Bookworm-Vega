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
import { counttypes, base_schema } from './schema';
import { extractRelevantField } from './time_handling';
// Keep a module-wide cache.

const definitions = {};

export default class Bookworm {

  constructor(selector, host, width = 600, height = 400) {
    // Bookworms must 
    this.selector = selector;
    this.width = width;
    this.height = height;
    this.history = [null];
    this.previous_aes = undefined;
    this.host = host;
    this.query = { 'search_limits': {},  host: host};
    this.schemas = {};
    this.data = [];
  }

  buildSpec(query, schema) {
    const { data, width, height } = this;
    const type = query.plottype;
    
    this.spec = new plots[type](query, schema)
      .data(this.smooth(data))
      .spec();
      
    this.spec.config = this.spec.config || {};
    this.spec.config.view = this.spec.config.view || {};
    this.spec.config.view.width = +width;
    this.spec.config.view.height = +height;
    this.spec = merge(this.spec, this.query.vega || {})
  }

  
  querySchema(query = {}) {
    const schema = JSON.parse(JSON.stringify(base_schema))
    const host = this.query.host || "http://localhost:10012"
    const dbname = this.query.database || "federalist_bookworm"
    return this._options(host, dbname).then(options => {
      schema.properties.database.default = dbname;
      const features = options.map(row => row.dbname)
      features.push("word")
      features.push("Search")
      const counts = keys(counttypes)
      const anything = features.concat(counts)
      const rows = counts.concat(features)
      schema.definitions.count_type.enum = counts;
      schema.definitions.metadata.enum = features; 
      schema.definitions.anything.enum = anything;
      schema.properties.aesthetic.additionalProperties.enum = anything;
//      schema.definitions.aesthetic.enum = rows;
      return schema;
    })
  }

  _options(host, db) {
    const k = `${host}-${db}`;
    if (this.schemas[k]) {
      // Wrap the cached value in a promise
      return Promise.resolve(this.schemas[k])
    }
    return bookwormFetch(
      {
        "method": "schema",
        "format": "json_c",
        "host": host,
        database: db
      }).then(val => {
        this.schemas[k] = val;
        return this.schemas[k];
      })
    
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
    query.database = query.database || this.query.database
    query.host = query.host || this.host
    console.log(query)
    this.query = alignAesthetic(query)
    console.log(query)
    if (drawing) {
      return Promise.all([
        this._options(query.host, query.database),
        bookwormFetch(query)
      ])
        .then((v) => {
          const [schema, data] = v;
          this.data = data
          this.buildSpec(query, schema)
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

function bookwormFetch(query, host) {
  let domain = host || query.host;

  const newQuery = alignAesthetic(query);
  newQuery.method = newQuery.method || "data"
  newQuery.format = newQuery.format || "json_c"

  const url = encodeURI(JSON.stringify(newQuery));

  console.log(domain)
  // This wrapper should only apply in an emergency, but currently
  // is always used.
  if (domain.startsWith("http:")) {
    //    domain = "https://cors-anywhere.herokuapp.com/" +  domain
  }
  
  const data_url = `${domain}/cgi-bin/dbbindings.py?query=${url}`
  return d3Fetch
    .json(data_url)
    .then( (data) => {
      if (data.status == "error") {
	throw data.message
      }
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

export function simplifyQuery(obj) {
  // JSON Schema likes to have arrays in a [{"key": foo, "value": bar}] format
  // that is more concisely represented as {"foo": bar}.

  const output = {};
  if (obj.length === undefined) {
    return obj
  }
  obj.forEach( o => {
    const {key, value} = o;
    output[key] = value
  })
  return output
}

function alignAesthetic(query) {
  // Percolate aesthetic to 'counttypes' or 'groups' as necessary.
  query.groups = [];
  query.counttype = [];
  if (query.aesthetic) {
    const remapped = simplifyQuery(query.aesthetic)
    keys(remapped).forEach( (key) => {
      const val = remapped[key]
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

function parseBookwormData(data, locQuery) {
  
  var names = []
  var bookworm = this
  const keyz = keys(data)

  const columns = keyz.map(
    k => data[k].map(
      // Test by properties if it's an array 
      d => d.reduceRight ?
        // If so, unroll it using the first (integer) key as the run-length.
        Array(d[0]).fill(d[1]):
        // otherwise, 
        d
    )
    // flatten out the nested lists.
      .flat()
  )

  keyz.forEach((k, i) => {
    
    const [f] = extractRelevantField(k)
    const dt = new Date()
    if (['month', 'day', 'week'].indexOf(f) > -1) {
      columns[i] = columns[i].map(d => {
        dt.setFullYear(0, 1, d)
        
        return dt.toISOString().split("T")[0]
      })
    }
  })
  
  // Columns[0] is a dummy; really just a range enumeration.
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
