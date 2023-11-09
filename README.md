# upload-cloudflare-r2

Github Action which upload files to Cloudflare R2

## Usage

```yaml
steps:
  - name: Upload to R2
    uses: wyhaya/upload-cloudflare-r2
    with:
      account_id: ${{ secrets.ACCOUNT_ID }}
      access_key_id: ${{ secrets.ACCESS_KEY_ID }}
      secret_access_key: ${{ secrets.SECRET_ACCESS_KEY }}
      bucket: ${{ secrets.BUCKET }}
      source_directory: target/files/
      # Optional
      destination_directory: release/
```
