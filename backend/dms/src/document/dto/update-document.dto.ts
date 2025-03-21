import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional } from "class-validator";

export class UpdateFolderDto {
    @ApiProperty()
    @IsNotEmpty()
    folderName: string;
}

export class UpdateFileDto {
    @ApiProperty()
    @IsNotEmpty()
    fileName: string;
}
