import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { DocumentService } from './document.service';
import { CreateDriveDto, CreateFolderDto, FileUploadDto, QueryParamsDto } from './dto/create-document.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateFileDto, UpdateFolderDto } from './dto/update-document.dto';

@ApiTags('DMS')
@Controller('document')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) { }
  
  @ApiOperation({
    summary: 'Create Drive',
    description: 'Endpoint for Create Drive in sharepoint.',
  })
  @ApiBody({type:CreateDriveDto})
  @Post('/drive')
  createDrive(@Body() createDriveDto: CreateDriveDto){
    return this.documentService.createDrive(createDriveDto);
  }
  
  @ApiOperation({
    summary: 'Create Folder',
    description: 'Endpoint for Create Folder in sharepoint.',
  })
  @ApiBody({type:CreateFolderDto})
  @Post('/folder')
  createFolder(@Body() createFolderDto: CreateFolderDto) {
    return this.documentService.createFolder(createFolderDto);
  }

  @ApiOperation({
    summary: 'Get Drive details',
    description: 'Endpoint for get single/multiple Drives in sharepoint.',
  })
  @Get('/drive')
  findDriveById(@Query() id: QueryParamsDto) {
    return this.documentService.findDriveById(id);
  }

  @ApiOperation({
    summary: 'Get file/folder details',
    description: 'Endpoint for get file/folder in sharepoint.',
  })
  @Get('resource/:id')
  listResource(@Param('id') id : string) {
    return this.documentService.listResource(id);
  }

  @ApiOperation({
    summary: 'Update folder name',
    description: 'Endpoint for update folder name in sharepoint.',
  })
  @Patch('folder/:id')
  updateFolderName(@Param('id') id :string , @Body() updateFolderDto : UpdateFolderDto){
    return this.documentService.updateFolderName(id,updateFolderDto);
  }

  @ApiOperation({
    summary: 'Update file name',
    description: 'Endpoint for file folder name in sharepoint.',
  })
  @Patch('file/:id')
  updateFileName(@Param('id') id :string , @Body() updateFileDto : UpdateFileDto){
    return this.documentService.updateFileName(id,updateFileDto);
  }


  @ApiOperation({
    summary: 'Upload file',
    description: 'Endpoint for upload file in sharepoint.',
  })
  @Post('/file/:id')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File upload',
    type: FileUploadDto,
  })
  uploadFile(@UploadedFile() file, @Param('id') folderId : string) {
    return this.documentService.uploadFile(file,folderId);
   }
}
