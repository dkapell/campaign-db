declare namespace Express {
   export interface Request {
      campaign?: Campaign,
      models?: Models,
      session: Session,
      audit?: Audit,
      user?:CampaignUser,
      checkPermission?:function
   }
}

interface Session extends SessionData {
   assumed_user?: CampaignUser
   campaignId?:number
   backto?: string
   admin_mode?: boolean
   gm_mode?: boolean
   player_mode?: boolean
   activeUser?: CampaignUser
}

interface CampaignUser {
   id: number,
   name?: string,
   email?: string,
   google_id?: string,
   site_admin?: boolean,
   type?: 'admin'|'core staff'|'contributing staff'|'event staff'|'player'|'none'
   campaignType?: string,
   notes?: string,
   drive_folder?: string,
   staff_drive_folder?: string,
   sso_name?: string
   scene_schedule_status?: string
   scene_request_status?: string
   scene_details?:Record<string, unknown>
   tags?: string[] | TagModel[]
   character?: CharacterData
   npc?:string
}

interface Models {
   [key:string]: ModelInterface | Database,
   database: Database
}

interface Character {
   id: number,
   user_id: number,
   [key:string]: object
}

interface CharacterOptions extends CharacterData {
    showAll?: boolean,
    noRestrictions?: boolean,
    cloneId?: number,
}

interface CharacterSheetOptions {
    margin?:number
    skillDescriptions?:boolean
    showLanguages?:boolean
    showRules?:boolean
    showInlineRules?:boolean
    titleScale?:number
    headerScale?:number
    bodyScale?:number
    template?:string
}

interface SurveyField {
    id?: string
    name: string
    type: string
    icon?: string
    sort_order?: number
    visible_to?: string
    editable_by?: string
    options?: string[]
    placeholder?: string
    rows?: number
    maxlength?: number
    content?: string
    description?: string
    days_before?:number
}

interface GoogleDocTextRun {
   content: string
   textStyle: Schema$TextStyle
   paragraphStyle?: string
}

interface PDFFeatures {
    columns?:number
    lineGap?:number
    paragraphGap?:number
    columnGap?:number
    continued?:boolean
    underline?:boolean
    strike?:boolean
}

interface OrderItem {
   type: string
   id: number
   name: string
   cost: number
   quantity?:number
}

interface SceneWarnings {
    warning: SceneIssueModel[]
    info: SceneIssueModel[]
}

interface SchedulerResult{
    unscheduled?: number
    schedule?: Schedule
    scenesProcessed?: number
    happiness?: number
    issues?: string[]
}

interface SchedulerOptions{
   runs?:number
   concurrency?: number
   maxScenesPerRun?:number
   skipPlayers?:boolean
   phase?:'all'|'requested'|'required'
}

interface SchedulerOutput{
    schedule: Schedule
    attempts?: number
    unscheduled?: number
    scenesProcessed?: number
    happiness?: Record<string,number>
    issues?: string[]
    processTime?:number
}

interface CharacterSheetTextOptions{
    font?:string
    nowrap?:boolean
    align?:string
}

interface ValidationCache{
    scenes?: SceneModel[]
    timeslots?: TimeslotModel[]
    attendees?: AttendanceModel[]
    schedule_busys?: ScheduleBusyModel[]
}

interface GetUsersAtTimeslotCache{
    users?: CampaignUser[]
    scenes?: FormattedSceneModel[]
    schedule_busys?: ScheduleBusyModel[]
}
