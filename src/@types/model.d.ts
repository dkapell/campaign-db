interface ModelData{
    [key:string]: unknown
}

interface ModelOptions {
    skipAuditFields?: string[]
    postSelect?: (data:ModelData) => Promise<ModelData>,
    postSave?: (id:number, ModelData) => Promise<void>,
    postDelete?: (condition: ComplexId, data:ModelData) => Promise<void>,
    validator?: (data: ModelData) => boolean,
    order?: string[],
    sorter?: (a:ModelData, b:ModelData)=>number,
    keyFields?: string[]
}

interface RequestOptions {
    postSelect?: (data: ModelData) => Promise<ModelData>,
    postSave?: (id: number, data:ModelData) => Promise<void>,
    postDelete?: (condition: ComplexId, data:ModelData) => Promise<void>,
    excludeFields?: string[]
    count?: boolean,
    limit?: number,
    offset?: number,
    order?: string[],
    skipRelations?:boolean
}

interface Conditions {
   [key:string]: string|number|boolean
}

type ComplexId = number|Conditions

interface IModel {
   table: string;
   fields: string[];
   options: ModelOptions;
   get: (id:number, options?: RequestOptions) => Promise<ModelData>
   find: (condition?:Conditions, options?: RequestOptions) => Promise<ModelData[]>
   findOne: (condition?:Conditions, options?: RequestOptions) => Promise<ModelData>
   list: (id:number, options?: RequestOptions) => Promise<ModelData[]>
   count: (condition:Conditions, options?: RequestOptions) => Promise<number>
   create: (data:ModelData) => Promise<number>
   update: (id:ComplexId, data:ModelData) => Promise<void>
   delete: (condition:ComplexId) => Promise<void>
}

interface ImageModel extends ModelData{
    id:number,
    name:string,
    display_name?:string
}

interface SkillProvide{
    type: string //Todo finish
}

interface TagModel extends ModelData{
    id: number
    campaign_id: number
    name: string
    category: string
    description: string
    display_to_pc:boolean
    on_sheet:boolean
    color: string
    type:string
}

interface SkillModel extends ModelData{
    id: number
    campaign_id: number
    name: string
    summary: string
    description: string
    notes: string
    cost: string
    source_id: number
    usage_id: number
    status_id: number
    provides: Provides
    requires: SkillModel[]
    require_num: number
    conflicts: SkillModel[]
    updated: Date
    required: boolean
    source: Record<string, unknown>
    usage: Record<string, unknown>
    status: Record<string, unknown>
    tags: string[]|TagModel[]
    details?: {
        hide_on_sheet:boolean
        sheet_note:string
        notes:string
    }
}

interface SourceTypeModel extends ModelData{
    id: number
    campaign_id: number
    name: string
    description: string
    display_order:number
    num_free:number
    display_on_sheet:boolean
    display_in_header:boolean
}

interface SourceModel extends ModelData{
    id: number
    campaign_id: number
    name: string
    description: string
    notes: string
    type_id: number
    cost: string
    provides: Provides
    requires: SourceModel[]
    require_num: number
    conflicts: SourceModel[]
    required: boolean
    display_to_pc: boolean
    type: SourceTypeModel
}

interface CharacterData extends ModelData {
    id?: number,
    user_id?: number,
    campaign_id?: number,
    extra_traits?: string,
    name?:string,
    notes?:string,
    gm_notes?:string,
    cp?: number,
    skills?: SkillModel[],
    sources?: SourceModel[],
    pronouns?: string,
    pronouns_other?:string,
    custom_field?: object | object[],
    active?:boolean,
    updated?: Date,
    provides?:Provides
    user?:CampaignUser
}

interface AttributeRecord {
    name: string
    value: number
    internal?:boolean
}

interface Provides {
    attributes: Record<string, number>|AttributeRecord[]
    internalAttributes: AttributeRecord[]
    styles: Record<string, number>
    traits: Record<string, string[]>
    skills: SkillModel[]
    languages: string[]
    tagskills: string[]
    diagnose: string[]
    crafting: Record<string, number>
    features: boolean,
    skill:boolean,

}
