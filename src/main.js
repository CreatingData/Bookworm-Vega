import * as d3Fetch from 'd3-fetch';
import vegaEmbed from 'vega-embed';
import { keys } from 'd3-collection';
// import 'vega-embed/vega-embed.scss';
import { timer } from 'd3-timer';
import { interpolate } from 'd3-interpolate';
import { merge, set } from 'lodash-es';
import { select, selectAll } from 'd3-selection';
import 'd3-transition';
import * as plots from './translators.js';
import smooth from './smooth.js'
import labels from './search_limit_labels.js';
import { counttypes, base_schema } from './schema.js';
import { extractRelevantField } from './time_handling.js';

// Keep a module-wide cache.
const definitions = {};

function clone(query) {
  return JSON.parse(JSON.stringify(query))
}

export default class Bookworm {

  constructor(selector, query = {host: undefined, database: undefined}) {
    // Bookworms must


    this.selector = selector;
    this.history = [];
    this.previous_aes = undefined;
    this.query = clone(query);
    this.schemas = {};
    this.data = [];
    // For programmatic reference.
    this.metrics = counttypes;
  }

  get width() {
    return window.innerWidth * .7
  }

  get height() {
    return window.innerHeight * .7
  }

  query_labeller(x) {
    // wrapped for export
    return labels(x)
  }

  get schema() {
    // Return schema for the currently defined database.
    if (this.query.database === undefined || this.query.host === undefined) {
      throw "Can't get schema without defining a database."
    }
    const {host, database} = this.query;
    return this._options(host, database)
  }

  buildSpec(query, schema) {
      const {
        data,
        width,
        height
      } = this;
      const type = query.plottype;
      /*
      if (query.search_limits.length > 1 && !query['aesthetic']['color']) {
        query['aesthetic']['color'] = "Search"
      }
      */

      this.spec = new plots[type](query, schema)
        .data(this.smooth(data))
        .spec();

      this.spec.config = this.spec.config || {};
      this.spec.config.view = this.spec.config.view || {};
      this.spec.config.view.width = +width;
      this.spec.config.view.height = +height;
      this.spec.config.autosize = {
        "type": "fit",
        "contains": "padding"
      }
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

  category_labels(field) {
    const {host, database} = this.query;
    const schema = this.schemas[`${host}-${database}`]
    if (schema) {
      // Breaks if the requested key isn't actually in the schema.
      const match = schema.filter(d => d.dbname==field)[0]
      if (match.top_100) {
        return Promise.resolve(match.top_100)
      }

      match.top_100 = [];
      const query = {
        host,
        database,
        method: "data",
        format: "json",
        search_limits: {},
        aesthetic: {
          y: field,
          x: "TextCount"
        }
      }
      query.search_limits[`${field}__id`] = {"$lte": 100}
      return bookwormFetch(query).then((data) => {
        match.top_100 = data
        return data
      })
    }  
  }

  async _options(host, db) {
    const k = `${host}-${db}`;
    if (this.schemas[k]) {
      // Wrap the cached value in a promise
      return this.schemas[k]
    }
    try {
      const val = await bookwormFetch(
        {
          "method": "schema",
          "format": "json_c",
          "host": host,
          database: db
        });
      this.schemas[k] = val;
      return this.schemas[k];
    } catch (err) {
      const val_1 = await bookwormFetch(
        {
          "method": "returnPossibleFields",
          "format": "json",
          "host": host,
          database: db
        });
      this.schemas[k] = val_1;
      return this.schemas[k];
    }
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

  async render() {
    await vegaEmbed(this.selector, this.spec);
    return this.make_marks_clickable(this.query);
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

  download() {
    const csv = csvFormat(this.data); // "foo,bar\n1,2"
    window.open("data:text/csv;charset=utf-8," + csv)

  }
  
  make_marks_clickable(locQuery) {
    
    const query = JSON.parse(serverSideJSON(locQuery))
    const root_limits = JSON.parse(serverSideJSON(locQuery)).search_limits

    query['method'] = 'search';
    query['format'] = 'json';

    // By default, open up a new window with the results.
    select("body").on("bookwormSearch", (event) => {
      console.log(event)
      
      show_search_results(event.detail.href_html)
    })

    select("g[aria-roledescription='rect mark container'],g[aria-roledescription='symbol mark container']")
    .selectAll("path")
    .on("click", function(d) {
      const datum = this.__data__.datum

      query['search_limits'] = root_limits[datum._search_index]
      query.groups.forEach( g => {
        let v = datum[g];
        if (g === 'year') {
          v = new Date(v + 1000 * 60 * 60 * 24).getFullYear()
        }
        query['search_limits'][g] = [v]
      })
      const query_string = encodeURI(JSON.stringify(query))
      const href_json = `${locQuery.host}/cgi-bin/dbbindings.py?${query_string}`
      query['method'] = 'html'
      const html_string = encodeURI(JSON.stringify(query))
      const href_html = `${locQuery.host}/cgi-bin/dbbindings.py?${query_string}`
      select(this).dispatch("bookwormSearch", {bubbles: true, cancelable: true, 
        detail: {href_html, href_json}})
      })
    }
plotAPI(inputQuery, drawing = true) {
  const query = JSON.parse(JSON.stringify(inputQuery))

  selectAll(this.selector).transition().duration(500).style("opacity", .33)
  // It's optional to pass the database and host every time.
  query.database = query.database || this.query.database
  query.host = query.host || this.query.host

  this.query = alignAesthetic(query)

  if (drawing) {
    return Promise.all([      
      this._options(query.host, query.database),
      bookwormFetch(query)
    ])
      .then(([schema, data]) => {
        //console.log(schema, data)
        this.data = data

        //console.log("parsed as", data)
        this.buildSpec(query, schema)
        this.history = [this.spec, this.history[0]]
        selectAll(this.selector).transition().duration(200).style("opacity", 1)
        return this.render()
      }).then(() => this)
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
          d._search_index = d.Search
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
  let d;
  if (locQuery.format == "json_c") {
    d = parseBookwormJSONC(data, locQuery)
  } else if (locQuery.format == "json") {
    if (locQuery.method == "returnPossibleFields") {
      return data
    }
    d = parseBookwormJson(data, locQuery)
  } else {
  }
  const results = d//add_href(d, locQuery)
  return results
}



function parseBookwormJson(json,locQuery) {
  // ancient code.
    // Changes the shape of the hierarchical json the API
    // delivers to a flat one with attribute names
    // which takes more space but plays more nicely with d3/javascript.
    // Uses recursion, yuck.
    var names = []
    names = names.concat(locQuery.groups).concat(locQuery.counttype);
    if (locQuery.search_limits.length) {
        names.unshift("Search")
    }
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
      throw err
        var flat = []
    }
    //add the labels.
    var results = flat.map(function(localdata){
        return(toObject(names,localdata));
    })

    return(results)

}


function parseBookwormJSONC(data, locQuery) {
  let names = []
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
    if (['year'].indexOf(f) > -1) {
      // Treat years as strings for Vega-lite.
      columns[i] = columns[i].map(d => {
        return "" + d
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



  // results = add_href(results, locQuery)


  return results
}


function create_search_results_div() {
  let container = selectAll("#bookworm-search")
  if (container.empty()) {
    container = select("body").append("div")
    .attr("id", "bookworm-search")
    .style("top", "0")
    .style("width", "100vw")
    .style("height", "100vh")
    .style("background", "rgba(254, 254, 254, 0.7)")
    .style("opacity", .95)
    .style("position", "fixed")

    container
    .append("div")
    .style("position", "fixed")
    .style("left", "15vw")
    .style("top", "15vh")
    .html(`
      <h4>Search Results</h4>
      <a class="close">close</a>

      Search results

      <ul id=search-results></ul>

      <a class="close">close</a>
    `)
    .on("click", (event) => {event.stopPropagation()})

    
  }
  container.selectAll(".close").on("click", (event) => {
    container.remove()
  })
  container.on("click", () => container.remove())
  return container;
}


function show_search_results(href) {
  d3Fetch.json(href).then(response => {
    const data = response.data
    const cont = create_search_results_div()
    cont.select("ul").selectAll("li").data(data).
    enter().append("li").html(d => d)
  })

}
