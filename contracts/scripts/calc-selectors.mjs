// Calculate function selectors 
import { keccak256, toHex } from 'viem';

const funcs = [
    'coreData(uint256)',
    'getLiveStats(uint256)',
    'getMoves(uint256)',
    'xp(uint256)',
    'getHP(uint256)',
    'ownerOf(uint256)',
    'balanceOf(address)',
    'totalSupply()',
];

for (const fn of funcs) {
    const hash = keccak256(toHex(fn));
    console.log(`${fn}: ${hash.slice(0, 10)}`);
}
