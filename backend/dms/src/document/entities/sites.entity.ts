import { 
  Table, 
  Column, 
  Model, 
  PrimaryKey, 
  Default, 
  DataType, 
  HasMany 
} from 'sequelize-typescript';
import { CommonEntity } from 'src/common.entity';
import { Drives } from './drives.entity';

@Table({ tableName: 'sites', timestamps: true ,paranoid: true, underscored: false})
export class Sites extends CommonEntity{
  
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique:true
  })
  siteid: string;

  @HasMany(() => Drives, {
    foreignKey: 'siteid',
    onDelete: 'CASCADE',
    sourceKey: 'id',
    as: 'drives'
  })
  drives: Drives[];

  
}
