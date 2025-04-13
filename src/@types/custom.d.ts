declare namespace Express {
   export interface Request {
      campaign?: Campaign,
      models?: Models,
      session: Session,
      audit?: Audit,
      user?:CampaignUser
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
   name: string,
   email: string,
   google_id: string,
   site_admin: boolean,
   type?: 'admin'|'core staff'|'contributing staff'|'event staff'|'player'|'none'
   campaignType?: string,
   notes?: string,
   drive_folder?: string,
   staff_drive_folder?: string,
   sso_name?: string
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
    headerScale?:number
    bodyScale?:number
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
