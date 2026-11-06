export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;  // Fast check for primitives and reference equality

  // If one is an object and the other isn't, they aren't equal
  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }

  // Compare lengths of keys in both objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;

  // Recursively check each key and its corresponding value
  for (let key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}