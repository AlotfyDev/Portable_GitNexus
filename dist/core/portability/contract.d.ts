export interface PortabilityContract {
    readonly isPortable: boolean;
    readonly hasNativeAddons: boolean;
    readonly hasWorkerPool: boolean;
    readonly hasLeidenAlgorithm: boolean;
    readonly hasVectorExtension: boolean;
    readonly hasHttpEmbeddings: boolean;
    readonly hasOnnxRuntimeNode: boolean;
    readonly hasCuda: boolean;
    readonly appDir: string;
}
declare class PortableContract implements PortabilityContract {
    readonly isPortable = true;
    readonly hasNativeAddons = false;
    readonly hasWorkerPool = false;
    readonly hasLeidenAlgorithm = false;
    readonly hasVectorExtension = true;
    readonly hasHttpEmbeddings = true;
    readonly hasOnnxRuntimeNode = false;
    readonly hasCuda = false;
    readonly appDir: string;
    constructor();
}
declare class DevContract implements PortabilityContract {
    readonly isPortable = false;
    readonly hasNativeAddons = true;
    readonly hasWorkerPool = true;
    readonly hasLeidenAlgorithm = true;
    readonly hasVectorExtension = true;
    readonly hasHttpEmbeddings = true;
    readonly hasOnnxRuntimeNode = true;
    readonly hasCuda = false;
    readonly appDir: string;
}
export { PortableContract, DevContract };
