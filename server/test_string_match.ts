import { StringUtils } from './src/rpa/utils/stringUtils';

const options = [
    "DRIVE 1.3 8V FIREFLY4P BAS AG",
    "DRIVE 1.3 8V FIREFLY4P BII AG",
    "DRIVE 1.3 8V FIREFLY4P COM AG",
    "DRIVE(DRIVE PLUS) 1.3 8V FIREFLY4P BAS AG",
    "DRIVE(DRIVE PLUS) 1.3 8V FIREFLY4P COM AG",
    "DRIVE(S-DESIGN) 1.3 8V FIREFLY4P BAS AG"
];

const target1 = "FIAT - CRONOS DRIVE 1.3";
const target2 = "DRIVE 1.3 8V FIREFLY";
const target3 = "CRONOS DRIVE";

console.log("Teste 1:", target1);
console.log("Melhor Match:", StringUtils.findBestMatch(target1, options));
console.log("---");

console.log("Teste 2:", target2);
console.log("Melhor Match:", StringUtils.findBestMatch(target2, options));
console.log("---");

console.log("Teste 3:", target3);
console.log("Melhor Match:", StringUtils.findBestMatch(target3, options));
console.log("---");
