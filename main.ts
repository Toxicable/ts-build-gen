import { readFileSync } from "fs";
import * as ts from "typescript";

export function gatherImportModuleNames(sourceFile: ts.SourceFile) {
    const moduleNames: string[] = [];
    nodeModuleNames(sourceFile);

    function nodeModuleNames(node: ts.Node) {
        if(node.kind === ts.SyntaxKind.ImportDeclaration) {
            const importNode = node as ts.ImportDeclaration;
            const mod = importNode.moduleSpecifier.getText()
            moduleNames.push(mod.replace(/\'/g, ''));
        }

        ts.forEachChild(node, nodeModuleNames);
    } 
    return moduleNames;
}

interface SourceFileInfo {
    sourceFile: ts.SourceFile;
    importModules: string[];
    bazelRepository?: string[];
}

function importsPerFile(fileNames: string[]) {
    const fileToImports = new Map<string, SourceFileInfo>();

    for(const file of fileNames) {
        
        const sourceFile = ts.createSourceFile(
            file,
            // maybe use ts to read the files instead?
            readFileSync(file).toString(),
            ts.ScriptTarget.ES2015,
            /*setParentNodes */ true
        );
        
        const moduleNames = gatherImportModuleNames(sourceFile);
        fileToImports.set(file, {sourceFile, importModules: moduleNames});
    }
    return fileToImports;
}

function translateImportsToRepositories(npmRepository: string, internalModules: Record<string, string>, file: SourceFileInfo) {
    const repositories = [];
    for(const imports of file.importModules) {
        if(internalModules[imports]) {
            repositories.push(internalModules[imports]);
        } else if(!imports.startsWith('.')) {
            repositories.push(`${npmRepository}//${imports}`);
        }
    }
    file.bazelRepository = repositories;
}



const argv = [
    "./workspace/apps/app1/main.ts",
    "./workspace/apps/app1/somefeature.ts",
];
const t = importsPerFile(argv);
for(const file of Array.from(t.values())){
    // npm repository needs to come from cli input
    // module map needs to come from cli input as well
    translateImportsToRepositories('@npm', {'@wksp/lib1': '//libs/lib1'}, file);
}

for(const [name, file] of Array.from(t.entries())){
    console.log(name, file.bazelRepository)
}