// import { keys } from 'd3-collection';
import { extend } from 'lodash-es';
import labels from './search_limit_labels.js';
import { simplify_query } from './query-util.js'
import { correctTimes } from './time_handling.js';

// Translators

class Translator {
  /*
    A translator takes a bookworm query and returns a
    vega-lite spec.

    The most important methods is 'translate', which builds the spec.

    This is undefined in the base class.

  */
  constructor(query, schema) {
    // The bookworm query
    this.query = query;
    this.schema = {"Search": {"dtype": "string"}};
    schema.forEach(row => {
      this.schema[row.dbname] = row
    })

    // The vega spec.
    this.p = {
//      "usermeta": {"embedOptions": {"renderer": "svg"}},
      transform: [],
      encoding: {},
    }
  }

  make_titles() {
    if (this.query.search_limits.length) {
      const [ baseq, diffs ] = labels(this.query.search_limits)
      this.p.title = {
        "orient": "bottom",
        "text": "Limits: " + baseq
      }
    }
  }

  spec(val) {
    const { data } = this;
    if (val === undefined) {
      this.translate()
      this.make_titles()
      return this.p
    } else {
      this.p = val
    }
  }

  translate() {
    throw ("No translation defined for this class")
  }

  data(data) {
    // Attaches data to the query.
    // Returns the translator
    this.p.data = { values: data }
    return this
  }

  aestheticize() {
    /*
      Create encodings on the vega-lite spec corresponding
      to the fields in the bookworm query 'aesthetic' field.
    */
    const { p, query, schema } = this;

    // Updates a copy of the spec and returns it.
    const aesthetic = simplify_query(query.aesthetic)
    p.encoding.tooltip = [{title: "Click for results"}]
    Object.keys(aesthetic).forEach(k => {
      // Handled specially by the choropleth code.
      if (k === 'state') {return}

      const val = aesthetic[k]
      let type = "quantitative"
      let timeUnit = undefined;
      if (schema[val]) {
        if (schema[val].dtype == 'character' || schema[val].dtype == 'string') {
          type = "nominal"
        }
        if (schema[val].dtype.startsWith('date')) {
          type = "temporal";
          timeUnit = "utcyearmonthdate";
        }
      }
      p.encoding[k] = extend(
          p.encoding[k], {
          field: val + "__disp",
          title: val,
          type: type,
          timeUnit
        }
      )

      p.encoding[k] = extend(p.encoding[k], correctTimes(val));

      if (val.endsWith("year")) {
        p.transform.push({
            filter: {field: val + "__disp", valid: true}
        })
      }
      p.encoding.tooltip.push(p.encoding[k])
    })
    console.log({p})

  }

}


export class streamgraph extends Translator {
  translate() {
    this.p = extend(this.p, {
      "mark": "area",
      "encoding": {
        x: {
        //  "axis": {"domain": false, "tickSize": 0}
        },
        y: {"stack": "center"},
        color: {type: "nominal"}
      }
    })
    this.aestheticize()
    return this.p
  }
}



export class USchoropleth extends Translator {

  // unusually, I have to overwrite the data method, b/c it goes some
  // where else.

  data(data) {
    const { state, color, row, column } = this.query.aesthetic;
    const to_match = [color, row, column]
    data.forEach(d => {
      d[state] = d[state].replace(" (State)", "")
    })
    this.p.transform = [{
      "lookup": "properties.NAME",
      "from": {
        "data": { "values": data },
        "key": state,
        "fields": to_match.filter(d => d) // (No undefined)
      }
    }]
    return this
  }

  expected() {
    return ["color", "state", "row", "column"]
  }

  translate() {
    this.p = extend(this.p, {
      "data": {
        "url": "/data/States.topojson",
        "format": {
          "type": "topojson",
          "feature": "-"
        }
      },
      "projection": {
        "type": "albersUsa"
      },
      "mark": "geoshape",
      "encoding": {
        "color": {
          "type":"quantitative"
        }
      }
    })
    this.aestheticize()
    return this.p

  }
}

export class heatmap extends Translator {
  translate() {
    const { query } = this;
    this.p = extend(this.p, {
      "mark": {"type": "rect"},
      "encoding": {

      }
    })
    this.aestheticize()
    return this.p
  }

}

export class barchart extends Translator {
  translate() {
    const { query, p } = this;
    this.p = extend(this.p, {
      "mark": {"type": "rect"},
      "encoding": {
        x: {"type": "quantitative"},
        y: {"type": "ordinal"},
      }
    })

    this.aestheticize()
    return this.p
  }
}


export class linechart extends Translator {
  translate() {
    const { query, p } = this;
    this.p = extend(this.p, {
      "mark": {"type": "line", "point": true},
      //"transform": [{"filter": {"selection": "hover"}}],
/*      "selection": {
        "brush": {"type": "interval", "encodings": ["x", "y"]}
      }, */
      "encoding": {
        x: {
          "type": "quantitative",
     //     "scale": {"domain": {"selection": "brush", "encoding": "x"}},
        },
        y: {
          "type": "quantitative",
          "scale": {
            "type": query.scaleType
          }
        },
      }
    })
    this.aestheticize()
    return this.p
  }

  expected() {
    return ["color", "state", "row", "column"]
  }

}

export class scatterplot extends Translator {

  translate() {
    const { query, p } = this;

    this.p = extend(this.p, {
      "mark": {"type": "circle", "size":30},
      "encoding":  {
        "y": {},//"type": "ordinal"},
        "x": {}//"type": "ordinal"}
      }
    })

    this.aestheticize()
    return this.p
  }
}

export class pointchart extends Translator {
  translate() {
    const { query, p } = this;
    this.p = extend(this.p, {
      "mark": {"type": "circle","size":120},
      "encoding": {
        "y": {
          // Baked in: we sort descending.
          "type": "nominal",
          "sort":{"op":"mean", "field": query.aesthetic.x, "order":"descending"}
        },

      }
    })
    this.aestheticize()
    return this.p
  }
}
