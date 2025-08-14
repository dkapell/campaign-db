interface ModelData{
    [key:string]: unknown
}

interface ModelOptions {
    skipAuditFields?: string[]
    postSelect?: (data:ModelData) => Promise<ModelData>
    preSave?: (data:ModelData) => Promise<ModelData>
    postSave?: (id:number, ModelData) => Promise<void>
    postDelete?: (condition: ComplexId, data:ModelData) => Promise<void>
    validator?: (data: ModelData) => boolean
    order?: string[]
    sorter?: (a:ModelData, b:ModelData)=>number
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
    skipPostSelect?:boolean
    noCache?:boolean
}

interface Conditions {
   [key:string]: string|number|boolean
}

type ComplexId = number|Conditions

interface IModel {
   table: string
   fields: string[]
   options: ModelOptions
   get: (id:number, options?: RequestOptions) => Promise<ModelData>
   find: (condition?:Conditions, options?: RequestOptions) => Promise<ModelData[]>
   findOne: (condition?:Conditions, options?: RequestOptions) => Promise<ModelData>
   list: (id:number, options?: RequestOptions) => Promise<ModelData[]>
   count: (condition:Conditions, options?: RequestOptions) => Promise<number>
   create: (data:ModelData) => Promise<number>
   update: (id:ComplexId, data:ModelData) => Promise<void>
   delete: (condition:ComplexId) => Promise<void>
}

interface UploadModel extends ModelData{
    id:number
    name:string
    user_id?:number
    campaign_id?: number
    display_name?:string
    upload?: UploadModel
    usedFor?: UploadUsedFor

}

interface MapModel extends ModelData{
    id?:number
    campaign_id?:number
    uuid?:string
    name?:string
    description?:string
    status?:string
    display_to_pc?:boolean
    image_id?:number
}

interface ImageModel extends ModelData{
    id:number,
    name:string,
    display_name?:string
    upload?: UploadModel
    display_to_pc?: boolean
}

interface TagModel extends ModelData{
    id:number
    campaign_id:number
    type:string
    name:string
}
interface SkillProvide{
    type: string //Todo finish
}

interface SkillTagModel extends ModelData{
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
    campaign_id?: number
    name?: string
    summary?: string
    description?: string
    notes?: string
    cost?: string
    source_id?: number
    usage_id?: number
    status_id?: number
    provides?: Provides
    requires?: SkillModel[]
    require_num?: number
    conflicts?: SkillModel[]
    updated?: Date
    required?: boolean
    source?: SourceModel
    usage?: Record<string, unknown>
    status?: Record<string, unknown>
    tags?: string[]|SkillTagModel[]
    count?: number
    uses?: number
    users?: number[]|string|string[]
    details?: {
        hide_on_sheet?:boolean
        sheet_note?:string
        notes?:string
    }
    scene_request_status?:string
}

interface CharacterSkillModel extends SkillModel{
    character_skill_id: number
    character_cost: number
    character_updated: Date
    removable: boolean
    no_remove_reason?: string
}

interface SourceTypeModel extends ModelData{
    id: number
    campaign_id: number
    name: string
    description: string
    display_order:number
    num_free:number
    max_sources:number
    display_on_sheet:boolean
    display_in_header:boolean
}


interface SourceModel extends ModelData{
    id: number
    campaign_id?: number
    name?: string
    description?: string
    notes?: string
    type_id?: number
    cost?: number
    provides?: Provides
    requires?: SourceModel[]|number[]
    require_num?: number
    conflicts?: SourceModel[]|number[]
    required?: boolean
    display_to_pc?: boolean
    type?: SourceTypeModel
    max_skills?: number
    users?: number[]|string|string[]
    scene_request_status?:string
}

interface CharacterSourceModel extends SourceModel{
    character_cost: number
    character_updated: Date
    characterSkills: CharacterSkillModel[]
    removable:boolean
    no_remove_reason?:string
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

interface SurveyModel extends ModelData {
    id?: number
    campaign_id?: number
    name?: string
    type?: string
    is_default?: boolean
    definition?: Record<string, unknown>
    created?: Date

}

interface EventModel extends ModelData {
    id?: number
    campaign_id?: number
    name?: string
    description?: string
    start_time?: Date
    end_time?: Date
    registration_open?:boolean
    cost?: number
    deleted?: boolean
    created?: Date
    hide_attendees?: boolean
    post_event_survey_deadline?: Date
    post_event_survey_id?: number
    post_event_survey?: SurveyModel
    pre_event_survey_id?: number
    pre_event_survey?: SurveyModel
    attendees?:AttendanceModel[]
}

interface AttendanceModel extends ModelData {
    id?: number
    campaign_id?: number
    event_id?: number
    user_id?: number
    character_id?: number
    paid?: boolean
    notes?: string
    pre_event_data?: Record<string, unknown>
    post_event_data?: Record<string, unknown>
    post_event_submitted?: boolean
    attending?: boolean
    created?: Date
    checked_in?: boolean
    attendance_cp_granted?: boolean
    post_event_cp_granted?: boolean
    post_event_hidden?: boolean
    user?:CampaignUser
}

interface AttributeRecord {
    name: string
    value: number|string
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
    features: boolean
    skill:boolean
    rules: SkillModel[]

}

interface AttendeeAddon {
    id?: number
    event_addon_id: number
    paid?: boolean
}

interface OrderItem extends ModelData{
   id?: number
   order_id?: number
   object_type?: string
   object_id?: number
   cost_in_cents?: number
   quantity?:number
   created?: Date
}

interface OrderModel extends ModelData{
    id?: number
    campaign_id?: number
    user_id?: number
    status?: string
    checkout_id?: string
    charge_id?: string
    payment_amount_cents?: number
    payment_note?: string
    created?: Date
    updated?: Date
    submitted?: Date
    paid?: Date
    order_items?: OrderItem[]
    user?: UserModel
}


interface TimeslotModel extends ModelData{
    id?: number
    campaign_id?: number
    day?: string
    start_hour?: number
    start_minute?: number
    length?: number
    payment_note?: string
    type?: string
    name?:string
    scene_request_status?:string
    scene_schedule_status?:string
    scenes?: FormattedSceneModel[]
    schedule_busy?:ScheduleBusyModel
}

interface LocationModel extends ModelData{
    id?: number
    campaign_id?: number
    name?:string
    display_order?: number
    multiple_scenes?: boolean
    combat?: boolean
    scene_request_status?:string
    scene_schedule_status?:string
}

type scenePrereq = number|SceneModel

interface SceneModel extends ModelData{
    id?:number
    campaign_id?:number
    event_id?:number
    name?:string
    player_name?:string
    status?:string
    description?:string
    schedule_notes?:string
    timeslot_count?:number
    setup_slots?:number
    cleanup_slots?:number
    display_to_pc?:boolean
    prereqs?:scenePrereq[]|string
    player_count_min?:number
    player_count_max?:number
    staff_count_min?:number
    staff_count_max?:number
    combat_staff_count_min?:number
    combat_staff_count_max?:number
    locations_count?:number
    staff_url?:string
    player_url?:string
    priority?:string
    timeslots?:TimeslotModel[]
    locations?:LocationModel[]
    users?:CampaignUser[]
    sources?:SourceModel[]
    skills?:SkillModel[]
    event?:EventModel|string
    tags?:TagModel[]
    score?:number
    prereq_of?:number[]
}

interface FormattedSourceModel{
    id?:number
    name?:string
    type?:string
    scene_request_status?:string
}

interface FormattedSkillModel{
    id?:number
    name?:string
    source?:string
    scene_request_status?:string
}


interface FormattedSceneModel extends ModelData{
    id?:number
    campaign_id?:number
    event_id?:number
    name?:string
    player_name?:string
    status?:string
    description?:string
    schedule_notes?:string
    timeslot_count?:number
    setup_slots?:number
    cleanup_slots?:number
    display_to_pc?:boolean
    prereqs?:scenePrereq[]|string
    player_count?:number
    staff_count?:number
    combat_staff_count?:number
    locations_count?:number
    staff_url?:string
    player_url?:string
    priority?:string
    timeslots?:Record<string, TimeslotModel[]>
    locations?:Record<string, LocationModel[]>
    players?:Record<string, CampaignUser[]>
    staff?:Record<string, CampaignUser[]>
    usersByStatus?:Record<string, CampaignUser[]>
    users?:CampaignUser[]
    sources?:Record<string, FormattedSourceModel[]>
    skills?:Record<string, FormattedSkillModel[]>
    event?:EventModel|string
    tags?:string[]
    score?:number
    start?:string
    duration?:number
    npc?:string
}

interface SceneUserModel extends ModelData{
    scene_id: number
    user_id: number
    details?:Record<string, unknown>
    schedule_status?: string
    request_status?:string
}

interface SceneLocationModel extends ModelData{
    scene_id: number
    location_id: number
    details?:Record<string, unknown>
    schedule_status?: string
    request_status?:string
}

interface SceneTimeslotModel extends ModelData{
    scene_id: number
    timeslot_id: number
    details?:Record<string, unknown>
    schedule_status?: string
    request_status?:string
}

interface ScheduleBusyTypeModel extends ModelData{
    id: number
    campaign_id?: number
    name?:string
    description?:string
    display_to_player?:boolean
    available_to_player?:boolean
    available_to_staff?:boolean
}

interface ScheduleBusyModel extends ModelData{
    id: number
    timeslot_id: number
    user_id: number
    event_id: number
    type_id: number
    name?: string
    type?: ScheduleBusyTypeModel
}

interface SceneIssueModel extends ModelData{
    id: number
    scene_id: number
    level: string
    code: string
    text:string
    ignored?: boolean
    resolved?: boolean
    created?: Date
}
