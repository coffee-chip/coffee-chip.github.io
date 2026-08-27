globalThis.document = {
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  documentElement: { dataset: {}, style: { colorScheme: '' } }
};
globalThis.window = {
  addEventListener() {},
  setTimeout,
  clearTimeout,
  matchMedia() { return { matches: false, addEventListener() {} }; }
};
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
globalThis.location = { hash: '' };

const [
  { validateApplicationContracts },
  { runEngineSelfTests },
  { validateQuizArchitecture },
  { validateTypeIcons }
] = await Promise.all([
  import('../js/appValidation.js'),
  import('../js/engine/effectiveness.js'),
  import('../js/quiz/validation.js'),
  import('../js/components/typeBadge.js')
]);

const results = [
  ...validateApplicationContracts(),
  ...runEngineSelfTests(),
  ...validateQuizArchitecture(),
  ...validateTypeIcons()
];
const failed = results.filter(result => !result.passed);

if (failed.length) {
  console.error(failed);
  process.exitCode = 1;
} else {
  console.log(`${results.length} application, engine, quiz, and icon checks passed.`);
}
