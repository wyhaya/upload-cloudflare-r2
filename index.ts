import { readdirSync, createReadStream, statSync } from 'node:fs'
import * as path from 'node:path'
import * as core from '@actions/core'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { lookup } from 'mime-types'
import prettyBytes from 'pretty-bytes'

const ACCOUNT_ID = core.getInput('account_id', { required: true })
const ACCESS_KEY_ID = core.getInput('access_key_id', { required: true })
const SECRET_ACCESS_KEY = core.getInput('secret_access_key', { required: true })
const BUCKET = core.getInput('bucket', { required: true })
const SOURCE_DIRECTORY = core.getInput('source_directory', { required: true })
const DESTINATION_DIR = core.getInput('destination_directory')
const CACHE_CONTROL = core.getInput('cache_control')

let destination = DESTINATION_DIR
if (destination !== '' && !destination.endsWith('/')) {
    destination += '/'
}

const sourceDir = path.join(process.cwd(), SOURCE_DIRECTORY)

const cacheRules: [RegExp, string | null][] = []
if (CACHE_CONTROL !== '') {
    const lines = CACHE_CONTROL.trim().split(/\r?\n/)
    for (let line of lines) {
        line = line.trim()
        if (line.startsWith('#') || line === '') {
            continue
        }
        const match = line.match(/^(\S+)\s+(.+)$/)
        if (match === null) {
            throw new Error(`Invalid cache line: ${line}`)
        }
        const [left, right] = [match[1], match[2]]
        if (left === undefined || right === undefined) {
            throw new Error(`Invalid cache line: ${line}`)
        }
        const reg = new RegExp(left)
        const cache = right === '_' ? null : right
        cacheRules.push([reg, cache])
    }
}
const cacheControl = (key: string): string | undefined => {
    let value = undefined
    for (const [reg, cache] of cacheRules) {
        if (reg.test(key)) {
            value = cache ?? undefined
        }
    }
    return value
}

const client = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY
    }
})

const files = readdirSync(sourceDir, { recursive: true, withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => path.join(dirent.parentPath, dirent.name))

const tasks = []
for (let filePath of files) {
    const body = createReadStream(filePath)
    const key = destination + path.relative(sourceDir, filePath)
    const mime = lookup(key) || 'application/octet-stream'
    const cache = cacheControl(key)

    const object = new PutObjectCommand({
        Bucket: BUCKET,
        Body: body,
        Key: key,
        ContentType: mime,
        CacheControl: cache
    })

    const task = async () => {
        const size = prettyBytes(statSync(filePath).size)
        const msg = `${filePath} '${key}' [${size}] [${mime}] [${cache ?? 'NO_SET_CACHE'}]`
        try {
            await client.send(object)
            core.info(`Uploaded: ${msg}`)
        } catch (err: any) {
            core.error(`Failed: ${msg}`)
            core.setFailed(err)
        }
    }
    tasks.push(task())
}

await Promise.all(tasks)
