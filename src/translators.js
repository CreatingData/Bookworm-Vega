import { keys } from 'd3-collection';
import { extend } from 'lodash-es';
import labels from './search_limit_labels';

// Translators

class Translator {
  /*
    A translator takes a bookworm query and returns a
    vega-lite spec.

    The most important methods is 'translate', which builds the spec.

    This is undefined in the base class.

  */
  constructor(query) {
    // The bookworm query
    this.query = query;
    // The vega spec.
    this.p = {
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
    this.p.data = {values: data}

    return this
  }

  aestheticize() {
    const { p, query } = this;

    // Updates a copy of the spec and returns it.
    keys(query.aesthetic).forEach(k => {

      // Handled by the choropleth code.
      if (k === 'state') {return}
      const val = query.aesthetic[k]
      p.encoding[k] = extend(p.encoding[k], { field: val })
      p.encoding[k] = extend(p.encoding[k], correctTimes(val));
      p.encoding['href'] = {'field': 'href', 'type': 'nominal'}
    })
  }

}

function correctTimes(f) {
  const field = extractRelevantField(f)
  if (field === 'year') {
    return { type: "ordinal", timeUnit: "utcyear"}
  } else {
    return {}
  }
}


var extractRelevantField = function(dateKey) {
  var output = undefined
  dateKey.split("_").reverse().forEach(function(phrase) {
    //The first date phrase to appear is the one we're using;
    //The reverse forEach means that's the one that will persist
    if (['year','month','day','week','decade','century',"Year","Decade","yearchunk","hour"].indexOf(phrase) >= 0) {output=phrase}
  })
  return output
}



export class streamgraph extends Translator {
  translate() {
    this.p = extend(this.p, {
      "mark": "area",
      "encoding": {
        x: {
          "axis": {"domain": false, "tickSize": 0}
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
        color: {"type": "quantitative"},
        x: {"type": "ordinal"},
        y: {"type": "ordinal"}
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
      "mark": {"type": "line"},
      "encoding": {
        x: {"type": "quantitative"},
        y: {"type": "quantitative"},

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
