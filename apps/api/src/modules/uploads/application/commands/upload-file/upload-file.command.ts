export class UploadFileCommand {
  constructor(
    public readonly buffer: Buffer,
    public readonly originalName: string,
    public readonly mimetype?: string,
    public readonly size?: number,
  ) {}
}
