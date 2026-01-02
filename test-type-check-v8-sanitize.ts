import { procxy } from './src/index.js';

class MyClass {
  constructor(public config: { data: string; value: number }) {}
}

// ✅ This should work - plain object with serializable properties
async function testValid() {
  const instance = await procxy(MyClass, './test.js', { serialization: 'advanced' } as const, {
    data: 'hello',
    value: 42
  });
}

// ❌ This WILL fail - passing function directly as arg
async function testInvalidTopLevel() {
  const instance = await procxy(
    MyClass,
    './test.js',
    { serialization: 'advanced' } as const,
    () => {} // Type error: function not assignable to V8Serializable
  );
}

// TypeScript can't catch nested properties due to structural typing
// But runtime validation will catch it
async function testNestedFunction() {
  const instance = await procxy(
    MyClass,
    './test.js',
    { serialization: 'advanced', sanitizeV8: true } as const,
    { data: 'hello', value: 42, handler: () => {} } // Compiles, but sanitized at runtime
  );
}
