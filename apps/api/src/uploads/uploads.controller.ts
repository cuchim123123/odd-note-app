import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { AccessTokenGuard } from '../common/guards/access-token.guard';

@Controller('uploads')
@UseGuards(AccessTokenGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.uploadsService.uploadBuffer(file.buffer, file.originalname, file.mimetype);
      return { url: result.url, signedUrl: result.signedUrl, key: result.key, originalName: file.originalname, size: file.size };
    } catch (err) {
      // log the original error for debugging
       
      console.error('Upload error:', err);
      throw new HttpException('Upload failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
