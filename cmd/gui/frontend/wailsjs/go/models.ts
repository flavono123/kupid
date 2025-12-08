export namespace main {
	
	export class ContextConnectionResult {
	    context: string;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ContextConnectionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.context = source["context"];
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class MultiClusterGVK {
	    group: string;
	    version: string;
	    kind: string;
	    contexts: string[];
	    allCount: number;
	
	    static createFrom(source: any = {}) {
	        return new MultiClusterGVK(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.version = source["version"];
	        this.kind = source["kind"];
	        this.contexts = source["contexts"];
	        this.allCount = source["allCount"];
	    }
	}

}

