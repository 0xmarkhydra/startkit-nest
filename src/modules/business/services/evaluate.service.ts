import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EvaluateRepository, EvaluateResultRepository, UserRepository } from '../../database/repositories';
import { Department, EvaluateCategory, EvaluateResultEntity, UserRole } from '@/database/entities';
import { title } from 'process';
import { EvaluateTab } from '../dtos/evaluate.dto';

// Interfaces for type safety
interface EvaluatePoint {
  order: number;
  point: number;
}

interface EvaluateItem {
  order: number;
  name: string;
  max_point: number;
  point?: number;
}

interface EvaluateResultData {
  create_id: string;
  member_id: string;
  results: EvaluateItem[];
  user_id?: string;
}

@Injectable()
export class EvaluateService {

  constructor(
    private readonly evaluateRepository: EvaluateRepository,
    private readonly evaluateResultRepository: EvaluateResultRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getEvaluate(category: EvaluateCategory): Promise<EvaluateItem[]> {
    console.log(`🔍 EvaluateService getEvaluate category:`, category);
    
    const data = await this.evaluateRepository.find({ 
      where: { category }, 
      order: { order: 'ASC' } 
    });
    
    return data.map((item) => ({
      order: item.order,
      name: item.name,
      max_point: item.max_point,
    }));
  }


  private mapEvaluatePoints(evaluate: EvaluateItem[], data: EvaluatePoint[]): EvaluateItem[] {
    console.log(`📊 EvaluateService mapEvaluatePoints data:`, { evaluate, data });
    
    return evaluate.map((item) => ({
      ...item,
      point: data.find((d) => d.order === item.order)?.point || 0,
    }));
  }

  private async handlePMEvaluation(
    createId: string,
    memberId: string,
    data: EvaluatePoint[],
    userId: string,
  ): Promise<boolean> {
    console.log(`📝 EvaluateService handlePMEvaluation:`, { createId, memberId, data });

    const evaluate = await this.getEvaluate(EvaluateCategory.ACHIEVEMENT_POINTS);
    const evaluateUpdate = this.mapEvaluatePoints(evaluate, data);
    
    return this.saveEvaluateResult({
      create_id: createId,
      member_id: memberId,
      results: evaluateUpdate,
      user_id: userId,
    });
  }

  private async handleOtherRoleEvaluation(
    createId: string,
    memberId: string,
    data: EvaluatePoint[],
    userId: string,
  ): Promise<boolean> {
    console.log(`📝 EvaluateService handleOtherRoleEvaluation:`, { createId, memberId, data, userId });

    const [evaluateAttitude, evaluateAchievement] = await Promise.all([
      this.getEvaluate(EvaluateCategory.ATTITUDE_POINTS),
      this.getEvaluate(EvaluateCategory.SPECIAL_REQUIREMENTS),
    ]);

    const evaluates = [...evaluateAttitude, ...evaluateAchievement]
      .sort((a, b) => a.order - b.order);
    
    const evaluateUpdate = this.mapEvaluatePoints(evaluates, data);

    return this.saveEvaluateResult({
      create_id: createId,
      member_id: memberId,
      results: evaluateUpdate,
      user_id: userId,
    });
  }

  private async saveEvaluateResult(data: EvaluateResultData): Promise<boolean> {
    console.log(`💾 EvaluateService saveEvaluateResult data:`, data);

    const existingResult = await this.evaluateResultRepository.findOne({ 
      where: { member_id: data.member_id } 
    });

    if (existingResult) {
      
      const idsUpdate = data.results.map((item) => item.order);
      const oldResults = existingResult.results.filter((item) => !idsUpdate.includes(item.order));
      const dataUpdate = [...data.results, ...oldResults]
        .sort((a, b) => a.order - b.order).slice(0, 14);

      console.log('dataUpdate', dataUpdate);
      const result = await this.evaluateResultRepository.update(
        existingResult.id,
        { 
          results: dataUpdate,
          create_id: data.create_id,
          user_id: data.user_id,
        }
      );
      return result.affected > 0;
    }

    const result = await this.evaluateResultRepository.save(data);
    return !!result;
  }

  async createEvaluateResult(
    createId: string, 
    memberId: string, 
    data: EvaluatePoint[], 
    role: UserRole.PM
  ): Promise<boolean> {
    console.log(`🎯 EvaluateService createEvaluateResult:`, { createId, memberId, data, role });

    try {
      if (role === UserRole.PM) {
        return this.handlePMEvaluation(createId, memberId, data, createId);
      }
      return this.handleOtherRoleEvaluation(createId, memberId, data, createId);
    } catch (error) {
      console.error(`❌ EvaluateService createEvaluateResult error:`, error);
      return false;
    }
  }

  async updateEvaluateResult(
    userId: string,
    memberId: string,
    data: EvaluatePoint[],
    createId: string,
    tab: EvaluateTab
  ): Promise<boolean> {
    const [user, userCreate, userMember] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.userRepository.findOne({ where: { id: createId } }),
      this.userRepository.findOne({ where: { id: memberId } })
    ]);

    if (!user || !userCreate || !userMember) {
      throw new NotFoundException('User not found');
    }
    console.log(`🔄 EvaluateService updateEvaluateResult:`, { userId, memberId, data, role: tab, createId });

    try {
      console.log('=====> role user', user.role);
      if (tab === EvaluateTab.PM) {
        return this.handlePMEvaluation(userId, memberId, data, createId);
      }
      if (tab === EvaluateTab.HR) {
        return this.handleOtherRoleEvaluation(userId, memberId, data, createId);
      }
      throw new ForbiddenException('You are not allowed to update evaluate result');


    } catch (error) {
      console.error(`❌ EvaluateService updateEvaluateResult error:`, error);
      return false;
    }
  }

  async getEvaluateResult() {
    const evaluate = await this.evaluateResultRepository.find({ 
      relations: ['user', 'create', 'member'],
      where: { } 
    });

    const evaluateArray = evaluate.map((item, index) => {
      console.log('item', item);
      // return {
      //   member: item.member.system_username,
      //   user: item.user.system_username,
      //   create: item.create.updated_at,
      //   results: item.results,
      // }
      const results = item.results;

      // array to object
      const resultsObject = results.reduce((acc, curr) => {
        acc[curr.order] = curr.point;
        return acc;
      }, {});

      return [
        index + 1,
        item.member.system_username,
        item.user.system_username,
        item.create.username,
        resultsObject[1],
        resultsObject[2],
        resultsObject[2],
        resultsObject[3],
        resultsObject[4],
        resultsObject[5],
        resultsObject[6],
        resultsObject[7],
        resultsObject[8],
        resultsObject[9],
        resultsObject[10],
        resultsObject[11],
        resultsObject[12],
        resultsObject[13],
        resultsObject[14],
      ]
    })

    return evaluateArray;
  }

  async getTitleEvaluate() {
    const evaluate = await this.evaluateRepository.find({ 
      where: { },
      order: { order: 'ASC' }
    });

    const evaluateArray = evaluate.map((item) => item.name)
    console.log('evaluateArray', evaluateArray);

    return ['STT', 'Nhân viên', 'Người đánh giá', 'Telegram đánh giá', ...evaluateArray];
  }


  async getDataExcel() {
    const titleIds = await this.getTitleEvaluate();
    const ids = await this.getEvaluateResult();
    return [titleIds, ...ids];
  }


  async onApplicationBootstrap() {
    // const data = await this.getDataExcel();

    // console.log('data', data);
    // const evaluate = await this.getEvaluate(EvaluateCategory.ACHIEVEMENT_POINTS);

    // console.log('evaluate', evaluate.map((item) => ({
    //   order: item.order,
    //   title: item.name,
    //   max_point: item.max_point,
    //   type: item.order === 7 ? 'string' : 'number',
    // })));
    // console.log(evaluate.map((item) => ({
    //   order: item.order,
    //   point: item.max_point,
    // })));
  }
} 