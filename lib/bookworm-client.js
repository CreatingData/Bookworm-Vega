import * as d3Fetch from 'd3-fetch';
// import vegaEmbed from 'vega-embed';
// import 'vega-embed/vega-embed.scss';
import { merge } from 'lodash-es';
import { select, selectAll } from 'd3-selection';
import 'd3-transition';
import * as plots from './translators.js';
import smooth from './smooth.js'
import labels from './search_limit_labels.js';
import { counttypes, base_schema } from './schema.js';
import { extractRelevantField } from './time_handling.js';
import { simplify_query } from './query-util.js';
// Keep a module-wide cache.
const definitions = {};

function clone(query) {
  return JSON.parse(JSON.stringify(query))
}

// Store schemas in a global variable.
const global_schemas = new Map();

class Bookworm {
  constructor(query, selector = undefined) {
    // Bookworms must
    const {host, database} = query;

    if (host === undefined || database === undefined) {
      throw "Bookworm must be initialized with a host and a database."
    }

    this.selector = selector;
    this.history = [];
    this.previous_aes = undefined;
    this.query = clone(query);
    this.data = [];
    // For downstream code to refer to.
    this.metrics = counttypes;
    try {
      window; //Don't bind if running on a node server.
      // By default, open up a new window with the results.
      select("body").on("bookworm", (event) => {      
        if (event.detail.type == "search") {
          show_search_results(event.detail.href_html)
        } else {
          console.log(event.detail.text)
        }
      })
    }
    catch(err) {
      // Do nothing.
    }

  }

  get _dtypes() {
    // Sychronous--unsafe outside this module.
    const {host, database} = this.query;
    const types = new Map()
    for (let {name, type} of global_schemas.get(`${host}-${database}`)) {
      types.set(name, type)
    }
    return types
  }

  get width() {
    return 640
  }

  get height() {
    return 480
  }

  get schema() {
    // Return schema for the currently defined database.
    if (this.query.database === undefined || this.query.host === undefined) {
      throw "Can't get schema without defining a database."
    }
    const {host, database} = this.query;
    return this._options(host, database)
  }

  query_labeller(x) {
    // Give a string label for a query for display in legends, etc.
    return labels(x)
  };

  async default_query() {
    const {host, database} = this.query;
    const schema = await this._options(host, database);
    const keys = schema.map(d => d.dbname)
    return {
      host,
      database,
      plottype: "barchart",
      aesthetic: {
        "y": keys[0],
        "x": "TextCount",
      },
      search_limits: [{}]
    }
  }

  querySchema(query = {}) {
    const schema = clone(base_schema)
    const host = this.query.host
    const dbname = this.query.database
    return this._options(host, dbname).then(options => {
      schema.properties.database.default = dbname;
      const features = options.map(row => row.dbname)
      features.push("word")
      features.push("Search")
      const counts = Object.keys(counttypes)
      const anything = features.concat(counts)
      const rows = counts.concat(features)
      schema.definitions.count_type.enum = counts;
      schema.definitions.metadata.enum = features;
      schema.definitions.anything.enum = anything;
      schema.properties.aesthetic.additionalProperties.enum = anything;
      return schema;
    })
  }

  async category_labels(field) {
    const {host, database} = this.query;
    const schema = await this.schema;
    // Breaks if the requested key isn't actually in the schema.
    const match = schema.filter(d => d.dbname==field)[0]
    if (match.top_100) {
      return match.top_100
    }
    
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
    query.search_limits[`${field}__id`] = {"$lte": 150}
    match.top_100 = bookwormFetch(query)
    return match.top_100;
  }

  async _options(host, db) {
    const k = `${host}-${db}`;
    if (global_schemas.get(k)) {
      // Wrap the cached value in a promise
      return global_schemas.get(k)
    }

    const val = await bookwormFetch( 
      {
        "method": "schema",
        "format": "json",
        database: db, 
        host
      });
    global_schemas.set(k, val)
    return val;
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

  /*
  Bad idea. Super slow.
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
  */

  message(content) {
    if (typeof(content) == "string") {
      content = {text: content}
    }
    if (content.type && ["search",  "warning", "error",  "info", "debug"].indexOf(content.type) < -1) {
      throw 'The only valid bookworm message classes are ["warning", "error",  "info", "debug"]'
    }
    if (!content.type) {
      content.type = "info"
    }

    select(this.selector).dispatch("bookworm", {
      bubbles: true, cancelable: true, 
      detail: content})
  }

    download() {
      const csv = csvFormat(this.data); // "foo,bar\n1,2"
      window.open("data:text/csv;charset=utf-8," + csv)
    }
  
    get max_groups() {
      return 40
    }

    render() {
      throw "No rendering strategy for the base bookworm class."
    }

    sanitize(query) {
      console.log("sanitizing")
      if (!query.search_limits.length) {
        query.search_limits = [query.search_limits]
      }
      for (let grouping of query.groups) {
        for (let limits of query.search_limits) {
          if (!limits[grouping] && !limits[`${grouping}__id`]) {
            if (this._dtypes.get(grouping) !== "character") {continue}
            console.log(this.schema)

            this.message({
              type: "warning",
              text: `Requested aggregation for ${grouping} without any filters, so automatically restricting to the top ${this.max_groups} categories.` 
            })
            limits[grouping + "__id"] = {"$lte": this.max_groups} 
          }
        }
      }
      return query
    }


    async update_query(inputQuery) {
      let query = clone(inputQuery)
      selectAll(this.selector).transition().duration(500).style("opacity", .33)
      // It's optional to pass the database and host every time.
      query.database = query.database || this.query.database
      query.host = query.host || this.query.host
      query = alignAesthetic(query)
      await this._options(query.host, query.database);
      query = this.sanitize(query)
      this.query = query
      return query
    }

    async vega_lite_spec(inputQuery) {
      // Return a vega-lite spec for the passed query.
      // This can then be dropped into a vega-lite chart 
      // loaded from elsewhere.
      await this.update_query(inputQuery)
      const { query } = this;
      return Promise.all([      
        this._options(query.host, query.database),
        bookwormFetch(query)
      ])
      .then(([schema, data]) => {
        this.data = add_display_names(data)
        this.buildVegaSpec(query, schema)
        this.history = [this.spec, this.history[0]]
        selectAll(this.selector).transition().duration(200).style("opacity", 1)
        return this.spec
      })
    }

    async plotAPI(inputQuery, drawing = true) {
      this.update_query(inputQuery)
      if (drawing) {
        this.vega_lite_spec(inputQuery)
        .then( () => this.render() )
        .then(() => this)
      }
    }
 
  buildVegaSpec(query, schema) {

    const {
        data,
        width,
        height
      } = this;
      /* This is included in the base class rather than 
      vega-lite for people who want to load vega-lite on their own (e.g.,)
      in observable.
      */
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

}

function validate(query) {
  // Throw errors on bad queries.
  // currently cursory
  if (!query.plottype) {throw("Must have a 'plottype' key")};
}


async function bookwormGet(query, host, format = "json") {
  let domain = host || query.host;
  if (!domain) {
    console.error("Must pass a domain")
  }
  const url = encodeURI(JSON.stringify(query));
  console.log(url)
  // This wrapper should only apply in an emergency, but currently
  // is always used.
  if (domain.startsWith("http:")) {
    //    domain = "https://cors-anywhere.herokuapp.com/" +  domain
  }
  const data_url = `${domain}/cgi-bin/dbbindings.py?query=${url}`
  return d3Fetch[format](data_url)

}

function bookwormFetch(query, host) {

  const newQuery = alignAesthetic(query);
  newQuery.method = newQuery.method || "data"
  newQuery.format = newQuery.format || "json"

  return bookwormGet(newQuery, host, "json")
    .then( (data) => {
        if (data.status == "error") {
	      throw data.message
      }

      if (newQuery.format == "json" && newQuery.method == "returnPossibleFields") {
        return data
      }
      const results = parseBookwormData(data.data, query)
      if (results[0]['Search'] !== undefined) {
        // More informative search labels.
        const [baseq, search_labels] = labels(query.search_limits)
        results.forEach(d => {
          d.Search__disp = search_labels[d.Search]
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
    const remapped = simplify_query(query.aesthetic)
    Object.keys(remapped).forEach( (key) => {
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
  var query = clone(queryFull)
  delete(query.aesthetic)
  delete(query.scaleType)
  delete(query.smoothingSpan)
  delete(query.plottype)
  delete(query.host)
  return JSON.stringify(query);

}

function parseBookwormData(data, locQuery) {
  let d;

  if (locQuery.format == "json") {
    if (locQuery.method == "returnPossibleFields") {
      return data
    }
    d = data;
  }

  const results = d


  if (results.length == 0) {return results}


  return results
}

function add_display_names(dataset) {
  // Create a parallel set of display names for Vega, since we need to tweak some values (especially dates).
  const ks = Object.keys(dataset[0]).filter(d => !d.endsWith("__disp"))
  const display_mappers = {}
  for (let name of ks) {
    const [ f ] = extractRelevantField(name)

    if (['month', 'day', 'week'].indexOf(f) > -1) {
      const dt = new Date()
      display_mappers[name] = (datum) => {
        const dt = new Date()
        dt.setFullYear(0, 1, datum[name])
        return dt.toISOString().split("T")[0]
      }
    } else if (['year'].indexOf(f) > -1) {
      // Treat years as strings for Vega-lite.
      display_mappers[name] = (datum) => datum[name] == 0 || datum[name] === null ? "INVALID YEAR" : 
      datum[name] < 1520 ? "YEAR BEFORE PRINT--DROPPING": 
      "" + datum[name]
    }
    else {
      display_mappers[name] = d => d[name]
    }
  }
  for (let row of dataset) {
    for (let [k, v] of Object.entries(row)) {
      // Don't overwrite to existing display fields.
      if (!k.endsWith("__disp") & !row[k + "__disp"]) {
        row[k + "__disp"] = display_mappers[k](row)
      }
    }
  }
  return dataset
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
  /*  Column oriented json. */
  let names = []
  const keyz = Object.keys(data)

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

  // Columns[0] is a dummy; really just a range enumeration.
  let results = columns[0]
    .map((x, i) => {
      const row = {};
      keyz.forEach((k, j) => {
        row[k] = columns[j][i]
      })
      return row;
    })

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
    console.log(response)
    const data = response.data
    const cont = create_search_results_div()
    cont.select("ul").selectAll("li").data(data).
      enter().append("li").html(d => d)
  })

}




export default class VegaBookworm extends Bookworm {
  // The base bookworm class doesn't include Vega-Lite code.

  getVegaEmbed() {
    if (!this._vegaEmbed) {
      throw "Must bind vega-embed to this._vegaEmbed"
    }
    return Promise.resolve(this._vegaEmbed)
  }

  async render() {
    const vegaEmbed = await this.getVegaEmbed()
    await vegaEmbed(this.selector, this.spec).then(result => {
      result.view.addEventListener('click', (event, item) => {
        if (!item.datum) {return}
          this._handle_mark_click(this.query, item.datum)
      });
    })
  }

  async search_results(datum, locQuery) {
    const {href_html, href_json} = this._mark_click_info(locQuery, datum)
    return fetch(href_json).then(d => d.json())
  }

  _mark_click_info(locQuery, datum) {
    const query = JSON.parse(serverSideJSON(locQuery))
    const root_limits = JSON.parse(serverSideJSON(locQuery.search_limits))
  
    query['method'] = 'search';
    query['format'] = 'json_c';
    if (datum['Search'] !== undefined) {
      query['search_limits'] = root_limits[datum["Search"]]
    } else {
      if (root_limits.length) {
        if (root_limits.length == 1) {
          query['search_limits'] = root_limits[0]
        } else {
          throw "Unsure which set of search limits to use."
        }
      } else {
        query['search_limits'] = root_limits
      }      
    }
  
    query.groups.forEach( g => {
      let v = datum[g];
      query['search_limits'][g] = [v]
    })

    console.log({query, datum})
    const query_string = encodeURI(JSON.stringify(query))
    const href_json = `${locQuery.host}/cgi-bin/dbbindings.py?${query_string}`
    query['method'] = 'html'
    const html_string = encodeURI(JSON.stringify(query))
    const href_html = `${locQuery.host}/cgi-bin/dbbindings.py?${query_string}`
    return {href_html, href_json}
  }

  _handle_mark_click(locQuery, datum) {
    const {href_html, href_json} = this._mark_click_info(locQuery, datum)
    this.message({
      type: "search",
      href_html,
      href_json
    })
  }
}