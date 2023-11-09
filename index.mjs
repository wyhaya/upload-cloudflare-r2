import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createReadStream } from 'fs'
import { lookup } from 'mime-types'
import * as path from 'path'
import * as klawSync from 'klaw-sync'
import * as core from '@actions/core'

const ACCOUNT_ID = core.getInput('account_id', { required: true })
const ACCESS_KEY_ID = core.getInput('access_key_id', { required: true })
const SECRET_ACCESS_KEY = core.getInput('secret_access_key', { required: true })
const BUCKET = core.getInput('bucket', { required: true })
const SOURCE_DIRECTORY = core.getInput('source_directory', { required: true })
const DESTINATION_DIR = core.getInput('destination_directory')

let destination = DESTINATION_DIR
if (destination !== '' && !destination.endsWith('/')) {
    destination += '/'
}

const sourceDir = path.join(process.cwd(), SOURCE_DIRECTORY)

const client = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY
    }
})

const files = klawSync.default(sourceDir, { nodir: true })
const tasks = []
for (let file of files) {
    const body = createReadStream(file.path)
    const key = destination + path.relative(sourceDir, file.path)
    const mime = lookup(key) || 'application/octet-stream'
    const object = new PutObjectCommand({
        Bucket: BUCKET,
        Body: body,
        Key: key,
        ContentType: mime
    })
    const task = async () => {
        try {
            await client.send(object)
            core.info(`Uploaded: '${file.path}' '${key}' '${mime}'`)
        } catch (err) {
            core.error(`Failed: '${file.path}' '${key}' '${mime}'`)
            core.setFailed(err)
        }
    }
    tasks.push(task())
}

await Promise.all(tasks)
