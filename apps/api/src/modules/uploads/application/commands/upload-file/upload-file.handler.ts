import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UploadFileCommand } from '@modules/uploads/application/commands/upload-file/upload-file.command';
import { STORAGE_PORT, type IStoragePort, type UploadResult } from '@modules/uploads/application/ports/storage.port';

@CommandHandler(UploadFileCommand)
export class UploadFileHandler implements ICommandHandler<UploadFileCommand> {
  constructor(
    @Inject(STORAGE_PORT)
    private readonly storagePort: IStoragePort,
  ) {}

  async execute(command: UploadFileCommand): Promise<UploadResult & { originalName: string; size?: number }> {
    const result = await this.storagePort.uploadBuffer(
      command.buffer,
      command.originalName,
      command.mimetype,
    );

    return {
      ...result,
      originalName: command.originalName,
      ...(command.size !== undefined && { size: command.size }),
    };
  }
}
