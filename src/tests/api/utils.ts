/**
 * @copyright 2025 Adeniyi Bella
 * @license Apache-2.0
 */

import { Project, SyntaxKind } from 'ts-morph';

/**
 * Utility to check if the current test file covers all methods of a given interface using describe blocks
 * @param interfacePath Path to the interface file (e.g., 'src/services/users/user.interface.ts')
 * @param interfaceName Name of the interface (e.g., 'IUserService')
 * @param testFilePath Path to the current test file (provided by Jest's __filename)
 */
export function checkInterfaceCoverage(interfacePath: string, interfaceName: string, testFilePath: string) {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json',
  });

  // Load the interface file
  const sourceFile = project.getSourceFileOrThrow(interfacePath);
  const targetInterface = sourceFile.getInterfaceOrThrow(interfaceName);

  // Get method names from the interface
  const interfaceMethods = targetInterface.getMethods().map(method => method.getName());

  // Load the current test file
  const testFile = project.getSourceFileOrThrow(testFilePath);
  const describeDescriptions = testFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(node => node.getExpression().getText() === 'describe')
    .map(node => node.getArguments()[0].getText().replace(/['"]/g, ''));

  // Check if each interface method has a describe block in the current file
  interfaceMethods.forEach(method => {
    const hasDescribe = describeDescriptions.some(desc => desc === method);
    if (!hasDescribe) {
      throw new Error(`No describe block found for ${interfaceName} method: ${method} in ${testFilePath}`);
    }
    expect(hasDescribe).toBeTruthy();
  });

  return interfaceMethods;
}