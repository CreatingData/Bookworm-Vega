import { keys } from 'd3-collection'

class Translator {

    constructor(query) {
        // The bookworm query
        this.query = query
        // The vega spec.
        this.p = {}
    }

    function spec(val) {
        if (val === undefined) {
            this.translate()
            return this.p
        } else {
            this.p = val
        }
    }

    function translate() {
       throw ("No translation defined for this class")
    }

    function data(data) {
        // Attaches data to the query.
        // Returns the translator
        this.p.data = {values: data}
        return this
    }

    function aestheticize() {
        const { p, query } = this;
        // Updates a copy of the spec and returns it.
        p.encoding = p.encoding || {}
        keys(query.aesthetic).forEach(k => {
            p.encoding[k] = p.encoding[k] || {}
            p.encoding[k]['field'] = query.aesthetic[k]
        })
    }

}

class pointchart extends Translator {
    
    function translate() {
        const { query, p } = this;
        const essential = {
            "mark": {"type": "circle","size":120},
            "encoding": {
                "y": {
                    // Baked in: we sort descending.
                    "sort":{"op":"mean", "field": query.aesthetic.x, "order":"descending"}
                }
            }
        }
        this.p = this.aestheticize()
        return this.p
    }
}
