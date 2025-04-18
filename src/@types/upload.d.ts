interface S3Location {
    key: string
    bucket: string
}

interface S3UploadParams{
    Bucket: string
    Key: string
    Expires?: number
    ContentType: string
    ACL?: string
}

interface UploadOptions {
   thumbnail?: boolean
   uriEncoded?: boolean
}

interface UploadSuccessData {
   url?: string
   thumbnailUrl?: string
}

interface UploadUsedFor{
   type: string
   id: number
   message: string
   event_id?: number
   attendance_id?:number
   user_id?:number
}
