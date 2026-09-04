const major = Number(process.versions.node.split('.')[0]);

if (major !== 22) {
  console.error(`Wording Lens site builds require the pinned Node.js 22 toolchain; current runtime is ${process.versions.node}.`);
  process.exit(1);
}

console.log(`Using supported Node.js ${process.versions.node} for the site build.`);
