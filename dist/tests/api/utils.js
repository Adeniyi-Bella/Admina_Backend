"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInterfaceCoverage = checkInterfaceCoverage;
const ts_morph_1 = require("ts-morph");
function checkInterfaceCoverage(interfacePath, interfaceName, testFilePath) {
    const project = new ts_morph_1.Project({
        tsConfigFilePath: './tsconfig.json',
    });
    const sourceFile = project.getSourceFileOrThrow(interfacePath);
    const targetInterface = sourceFile.getInterfaceOrThrow(interfaceName);
    const interfaceMethods = targetInterface.getMethods().map(method => method.getName());
    const testFile = project.getSourceFileOrThrow(testFilePath);
    const describeDescriptions = testFile
        .getDescendantsOfKind(ts_morph_1.SyntaxKind.CallExpression)
        .filter(node => node.getExpression().getText() === 'describe')
        .map(node => node.getArguments()[0].getText().replace(/['"]/g, ''));
    interfaceMethods.forEach(method => {
        const hasDescribe = describeDescriptions.some(desc => desc === method);
        if (!hasDescribe) {
            throw new Error(`No describe block found for ${interfaceName} method: ${method} in ${testFilePath}`);
        }
        expect(hasDescribe).toBeTruthy();
    });
    return interfaceMethods;
}
