
export function simplify_query(obj) {
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