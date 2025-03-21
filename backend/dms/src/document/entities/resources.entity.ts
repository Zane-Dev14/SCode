import { Column, DataType, Table, ForeignKey, BelongsTo } from 'sequelize-typescript';

import { Drives } from './drives.entity';
import { CommonEntity } from 'src/common.entity';

@Table({
    tableName: 'resources', timestamps: true, paranoid: true, underscored: false,
})
export class Resources extends CommonEntity {

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    name: string;

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    resourceid: string;

    @Column({
        type: DataType.STRING,
        allowNull: false,
    })
    type: string; // Either 'folder' or 'file'

    @ForeignKey(() => Drives)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    driveid: string;

    @ForeignKey(() => Resources)
    @Column({
        type: DataType.UUID,
        allowNull: true,
    })
    parentid: string; // Self-referencing column

    @Column({
        type: DataType.STRING,
        allowNull: true,
    })
    webUrl: string; // Self-referencing column

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    downloadUrl: string; // Self-referencing column

    @BelongsTo(() => Resources, {
        foreignKey: 'parentid',
        targetKey: 'id',
        as: 'resources'
    })
    parent: Resources;

    @BelongsTo(() => Drives, {
        foreignKey: 'driveid',
        targetKey: 'id',
        as: 'drives'
    })
    drive: Drives;
}
