import { isEqual } from 'lodash-es'

export default function(qs) {
  // return the different elements of a set.
  const baseq = base(qs)
  const diffs = qs.map((q,i) => {
    const newer = JSON.parse(JSON.stringify(q))
    Object.keys(q).forEach( k => {
      if (isEqual(baseq[k], newer[k])) {
        delete newer[k] 
      }
    })
    return label(newer)
  })
  return [label(baseq), diffs]
}

function label(q) {
  const labs = Object.entries(q).map(kv => {
    let [k, v] = kv;
    if (v.length) {
      v = v.join("|")
    } else if (v["$gte"] || v["$lte"]) {
      // Expand to handle $gt, $lt, and only one of them.
      return `${v["$gte"]} <= ${k} <= ${v["$lte"]}`
    }
    return `${k}: ${JSON.stringify(v)}` 
  })
  return labs.join(", ")
}

function base(qs) {
  // Return the shared elements of a set.
  const base = JSON.parse(JSON.stringify(qs[0]))
  qs.slice(1).forEach( (qn) => {
    Object.keys(base).map((k) => {
    if (!isEqual(base[k], qn[k])) {
      delete base[k]
    }
   })
  })
  return base
}
