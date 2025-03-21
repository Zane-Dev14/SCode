import { UUIDV4 } from 'sequelize';
import { Column, DataType, Model } from 'sequelize-typescript';

export class CommonEntity extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: UUIDV4,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING(50),
    allowNull:false,
    defaultValue: 'UTC',
  })
  time_zone:string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  createdBy: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  updatedBy: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    defaultValue: null,
  })
  deletedBy: string;
}
