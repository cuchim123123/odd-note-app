import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UploadFileCommand } from './upload-file.command';
import { STORAGE_PORT, type IStoragePort, type UploadResult } from '../../ports/storage.port';

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
