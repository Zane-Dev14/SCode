import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateDriveDto, CreateFolderDto, QueryParamsDto } from './dto/create-document.dto';
import { GraphApiService } from '@gnx/graphapi';
import { AppLogger } from '@gnx/logger';
import { ModelLoaderService } from '@gnx/database';
import { Op, where } from 'sequelize';
import { UpdateFileDto, UpdateFolderDto } from './dto/update-document.dto';
import { ResourceType } from './enum/document.enum';
import { StatusCode, ErrorMessages } from '@gnx/error-handler';
@Injectable()
export class DocumentService {
  private readonly logger: AppLogger;
  constructor(private readonly graphApiService: GraphApiService,
    private readonly modelLoaderService: ModelLoaderService
  ) {
    this.logger = new AppLogger(DocumentService.name);
  }


  async createDrive(createDriveDto: CreateDriveDto) {
    try {
      const { Sites, Drives } = await this.modelLoaderService.loadModels();
      try {
        const sites = await Sites.findOne();
        const drive = await this.graphApiService.createDrive(sites.siteid, createDriveDto.displayName, createDriveDto.template) as any;
        const drives = await this.graphApiService.getAllDrive(sites.siteid) as any;
        const driveId = drives.value.find(obj => obj.name === drive.name)?.id;
        const data = await Drives.create({
          name: createDriveDto.displayName,
          driveid: driveId,
          siteid: sites.id,
          createdBy: sites.createdBy,
          updatedBy: sites.updatedBy
        })
        return data;
      } catch (error) {
        throw new BadRequestException(error);
      }
    } catch (error) {
       throw new BadRequestException(error);
    }
  }

  async createFolder(createFolderDto: CreateFolderDto) {
    try {
      const { Drives, Resources } = await this.modelLoaderService.loadModels();
      try {
        const driveId = await Drives.findOne({ where: { id: createFolderDto.id } });
        if (driveId) {
          return this.createParentFolder(createFolderDto, driveId, Resources)
        }
        else {
          return this.createSubFolder(createFolderDto, Drives, Resources)
        }
      } catch (error) {
        throw new BadRequestException({
          statusCode: StatusCode.BadRequestException,
          error: ErrorMessages.BadRequestException,
          message: error?.detail || error?.message || error,
        });
      }
    } catch (error) {
       throw new BadRequestException(error);
    }
  }

  async createParentFolder(createFolderDto: CreateFolderDto, driveId, Resources) {
    try {
      const folder = await this.graphApiService.createFolder(driveId.driveid, createFolderDto.folderName, createFolderDto.folder) as any;
      const data = await Resources.create({
        name: createFolderDto.folderName,
        resourceid: folder.id,
        type: ResourceType.FOLDER,
        driveid: driveId.id,
        createdBy: driveId.createdBy,
        updatedBy: driveId.updatedBy
      })
      return data
    } catch (error) {
       throw new BadRequestException(error);
    }
  }

  async createSubFolder(createFolderDto: CreateFolderDto, Drives, Resources) {
    try {
      const resourceWithDrive = await Resources.findOne({
        where: { id: createFolderDto.id }, // Fetch the resource by its ID
        include: [
          {
            model: Drives, // Include the associated Drive details
            required: false, // Set to true if the drive must exist, false otherwise
          },
        ],
      });
      const childFolder = await this.graphApiService.createSubFolder(resourceWithDrive.drives.driveid, createFolderDto.folderName, resourceWithDrive.resourceid, createFolderDto.folder) as any;
      const data = await Resources.create({
        name: createFolderDto.folderName,
        resourceid: childFolder.id,
        type: ResourceType.FOLDER,
        parentid: resourceWithDrive.id,
        driveid: resourceWithDrive.drives.id,
        createdBy: resourceWithDrive.createdBy,
        updatedBy: resourceWithDrive.updatedBy
      })
      return data
    } catch (error) {
      console.log({ error });
       throw new BadRequestException(error);
    }
  }

  async findDriveById(id: QueryParamsDto) {
    try {
      const { Drives } = await this.modelLoaderService.loadModels();
      try {
        let drives
        if (id)
          drives = await Drives.findOne(id);
        else
          drives = await Drives.findAll();
        return drives;
      } catch (error) {
        throw new BadRequestException({
          statusCode: StatusCode.BadRequestException,
          error: ErrorMessages.BadRequestException,
          message: error?.detail || error?.message || error,
        });
      }
    } catch (error) {
      console.log({ error });

       throw new BadRequestException(error);
    }

  }

  async listResource(id: string) {
    try {
      const { Drives, Resources } = await this.modelLoaderService.loadModels();
      try {
        const resources = await Resources.findAll({
          where: {
            [Op.or]: [
              { parentid: id },
              { parentid: { [Op.is]: null }, driveid: id }
            ]
          }
        });
        return resources;
      } catch (error) {
        throw new BadRequestException({
          statusCode: StatusCode.BadRequestException,
          error: ErrorMessages.BadRequestException,
          message: error?.detail || error?.message || error,
        });
      }

    } catch (error) {
      console.log({ error });
       throw new BadRequestException(error);
    }
  }

  async updateFolderName(id: string, updateFolderDto: UpdateFolderDto) {
    try {
      const { Drives, Resources } = await this.modelLoaderService.loadModels();
      try {
        const resourceWithDrive = await Resources.findOne({
          where: { id: id }, // Fetch the resource by its ID
          include: [
            {
              model: Drives, // Include the associated Drive details
              required: false, // Set to true if the drive must exist, false otherwise
            },
          ],
        });
        const folder = await this.graphApiService.updateFolderName(resourceWithDrive.drives.driveid, resourceWithDrive.resourceid, updateFolderDto.folderName);
        await Resources.update(
          { name: updateFolderDto.folderName },
          { where: { id: id } }
        );
        return {
          success: true,
          statusCode: 204,
          message: `'${resourceWithDrive.name}' folder has been updated to name '${updateFolderDto.folderName}'`
        }
      } catch (error) {
        console.log({ error });
        throw new BadRequestException({
          statusCode: StatusCode.BadRequestException,
          error: ErrorMessages.BadRequestException,
          message: error?.detail || error?.message || error,
        });
      }
    } catch (error) {
       throw new BadRequestException(error);
    }
  }

  async updateFileName(id: string, updateFileDto: UpdateFileDto) {
    try {
      const { Drives, Resources } = await this.modelLoaderService.loadModels();
      try {
        const resourceWithDrive = await Resources.findOne({
          where: { id: id }, // Fetch the resource by its ID
          include: [
            {
              model: Drives, // Include the associated Drive details
              required: false, // Set to true if the drive must exist, false otherwise
            },
          ],
        });
               
        const folder = await this.graphApiService.updateFileName(resourceWithDrive.drives.driveid, resourceWithDrive.resourceid, updateFileDto.fileName);
        console.log({folder});
        
        await Resources.update(
          { name: updateFileDto.fileName },
          { where: { id: id } }
        );
        return {
          success: true,
          statusCode: 204,
          message: `'${resourceWithDrive.name}' file has been updated to name '${updateFileDto.fileName}'`
        }
      } catch (error) {
        console.log({ error });
        throw new BadRequestException({
          statusCode: StatusCode.BadRequestException,
          error: ErrorMessages.BadRequestException,
          message: error?.detail || error?.message || error,
        });
      }
    } catch (error) {
       throw new BadRequestException(error);
    }
  }

  async uploadFile(file, folderId: string) {
    try {
      const { Drives, Resources } = await this.modelLoaderService.loadModels();
      try {

        const resourceWithDrive = await Resources.findOne({
          where: { id: folderId }, // Fetch the resource by its ID
          include: [
            {
              model: Drives, // Include the associated Drive details
              required: false, // Set to true if the drive must exist, false otherwise
            },
          ],
        });
        const fileData = await this.graphApiService.uploadFile(resourceWithDrive.drives.driveid, resourceWithDrive.resourceid, file.buffer.data, file.originalname) as any;

        const data = await Resources.create({
          name: file.originalname,
          resourceid: fileData.id,
          type: ResourceType.FILE,
          parentid: resourceWithDrive.id,
          driveid: resourceWithDrive.drives.id,
          webUrl: fileData.webUrl,
          downloadUrl: fileData['@microsoft.graph.downloadUrl'],
          createdBy: resourceWithDrive.createdBy,
          updatedBy: resourceWithDrive.updatedBy
        })
        return data
      } catch (error) {
        throw new BadRequestException({
          statusCode: StatusCode.BadRequestException,
          error: ErrorMessages.BadRequestException,
          message: error?.detail || error?.message || error,
        });
      }
    } catch (error) {
       throw new BadRequestException(error);
    }
  }
}
