// Mesures exploratoires du jeu actuel : mêmes IA, vrais classements et graines reproductibles.
const { parseArguments, argumentHelp, runCli } = require('./lib/simulation.js');
const { runBalance, formatBalance } = require('./lib/equilibrage.js');

runCli(() => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) { console.log(argumentHelp('equilibrage.js')); return; }
  const report = runBalance(options);
  console.log(options.json ? JSON.stringify(report, null, 2) : formatBalance(report));
  if (report.counts.truncated) process.exitCode = 2;
});
