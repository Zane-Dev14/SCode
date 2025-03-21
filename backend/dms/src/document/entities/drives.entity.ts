import { Column, DataType, Table, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { Sites } from './sites.entity';
import { CommonEntity } from 'src/common.entity';
import { Resources } from './resources.entity';

@Table({
  tableName: 'drives', timestamps: true, paranoid: true, underscored: true,
})
export class Drives extends CommonEntity {


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
  driveid: string;

  @ForeignKey(() => Sites)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  siteid: string;

  @BelongsTo(() => Sites, {
    foreignKey: 'siteid',
    targetKey: 'id',
    as: 'sites'
  })
  site: Sites;

  @HasMany(() => Resources, {
    foreignKey: 'driveid',
    onDelete: 'CASCADE',
    sourceKey: 'id',
    as: 'resources'
  })
  resources: Resources[];
}
