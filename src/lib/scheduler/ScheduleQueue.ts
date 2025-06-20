'use strict'
import _ from 'underscore';
import ScheduleScene from './ScheduleScene';

class ScheduleQueue{
    protected scenes: ScheduleScene[];
    protected processQueue: number[];
    protected currentItem: ScheduleScene;
    
    constructor(scenes:ScheduleScene[]){
        this.scenes = scenes;
        this.processQueue = _.pluck(scenes, 'id');
    }

    restart(): number {
        this.processQueue = _.pluck(this.scenes, 'id');
        return this.processQueue.length;
    }

    next(): ScheduleScene{
        if (!this.processQueue.length){
            return;
        }
        const id = this.processQueue.shift();
        this.currentItem = _.findWhere(this.scenes, {id:id});
        return this.currentItem;
    }

    enqueue(sceneId:number, next:boolean=false){
        if (!_.findWhere(this.scenes, {id:sceneId})){
            return;
        }

        if (_.indexOf(this.processQueue, sceneId) !== -1){
            return;
        }
        if (next){
            this.processQueue.unshift(sceneId);
        } else {
            this.processQueue.push(sceneId);
        }
    }

    get queue(): number[]{
        return this.processQueue;
    }

    get length(): number{
        return this.processQueue.length;
    }

    addScene(scene: ScheduleScene){
        if (!_.findWhere(this.scenes, {id:scene.id})){
            this.scenes.push(scene);
        }
    }
}

export default ScheduleQueue;
