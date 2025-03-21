import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional } from "class-validator";

export class CreateFolderDto {
    @ApiProperty()
    @IsNotEmpty()
    id:string

    @ApiProperty()
    @IsNotEmpty()
    folderName: string;

    @ApiPropertyOptional()
    @IsOptional()
    folder?: object;
}


export class FileUploadDto {
    @ApiProperty({ type: 'string', format: 'binary' })
    file: any;
  }

export class CreateDriveDto{
    @ApiProperty()
    @IsNotEmpty()
    displayName: string;

    @ApiProperty({ example: 'documentLibrary' })
    @IsNotEmpty()
    template?: string;
}
  
export class QueryParamsDto {
    @ApiPropertyOptional()
    @IsOptional()
    id: string;
  }
