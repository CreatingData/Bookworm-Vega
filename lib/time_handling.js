

// Bookworm stores times as 4 byte integer days.

export function correctTimes(f) {
  const [field, round] = extractRelevantField(f)
  if (field === undefined) {return undefined}
  if (field === 'year') {
    return { type: "temporal", timeUnit: "utcyear"}
  } else if (['month', 'day', 'week'].indexOf(field) > -1) {
    if (round === "year") {
      // Abstract month format if year is undefined.
      return { type: "temporal" ,  timeUnit: "utcmonthdate"}        
    }
    return { type: "temporal" ,  timeUnit: "utcyearmonthdate"}
  }
  throw "Still incorrectly trying to correct times."
}



export function extractRelevantField(dateKey) {
  var output = undefined
  
  const time_phrases = new Set(['year','month','day','week','decade','century',
  "Year","Decade","yearchunk","hour"])
  return dateKey.split("_").filter(d => time_phrases.has(d))
}
