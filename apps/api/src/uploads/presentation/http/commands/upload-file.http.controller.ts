import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { UploadFileCommand } from '../../../application/commands/upload-file/upload-file.command';

@Controller('uploads')
@UseGuards(AccessTokenGuard)
export class UploadFileHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.commandBus.execute(
        new UploadFileCommand(file.buffer, file.originalname, file.mimetype, file.size)
      );
      return result;
    } catch (err) {
      console.error('Upload error:', err);
      throw new HttpException('Upload failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
