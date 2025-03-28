import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EvaluateRepository, UserRepository } from '../repositories';
import { Department, UserRole } from '../entities/user.entity';
import { EvaluateCategory, EvaluateType } from '../entities/evaluate.entity';

const members = [
  { name: 'Nguyễn Xuân', department: 'Design' },
  { name: 'Nguyễn Hiền', department: 'Design' },
  { name: 'Hải Sơn', department: 'Design' },

  { name: 'Duy Hiếu', department: 'TESTER' },
  { name: 'Tình', department: 'TESTER' },
  { name: 'Mai Phương', department: 'TESTER' },

  { name: 'Nguyễn Tuấn Hưng', department: 'DEV' },
  { name: 'Trần Văn Thành', department: 'DEV' },
  { name: 'Nguyễn Cảnh Nguyên', department: 'DEV' },
  { name: 'Dương Trung Kiên', department: 'DEV' },
  { name: 'Nguyễn Xuân Lộc', department: 'DEV' },
  { name: 'Ngô Anh Quân', department: 'DEV' },
  { name: 'Phan Hà Duy', department: 'DEV' },
  { name: 'Lê Văn Mong', department: 'DEV' },
  { name: 'Bùi Thanh Tuấn', department: 'DEV' },
  { name: 'Nguyễn Văn Hiếu', department: 'DEV' },
  { name: 'Trịnh Công Đạt', department: 'DEV' },
  { name: 'Trần Văn Hiếu', department: 'DEV' },
  { name: 'Trịnh Văn Vinh', department: 'DEV' },
  { name: 'Hà Văn Đạt', department: 'DEV' },
  { name: 'Đỗ Tùng Dương', department: 'DEV' },
  { name: 'Đỗ Hoàn', department: 'DEV' },
  { name: 'Nguyễn Xuân Kiên', department: 'DEV' },
  { name: 'Trần Công Minh', department: 'DEV' },

  { name: 'Vũ Minh Hiếu', department: 'AI' },
  { name: 'Nguyễn Văn Hiệp', department: 'AI' },
  { name: 'Ngô Phương Anh', department: 'AI' },
  { name: 'Đào Thu Huyền', department: 'AI' },
  { name: 'Nguyễn Hữu Thắng', department: 'AI' },

  { name: 'Đỗ Xuân Hải', department: 'BD' },
  { name: 'Cao Bá Quang', department: 'BD' },
  { name: 'Nguyễn Chi Mai', department: 'BD' },
  { name: 'Hồ Trung Hiếu', department: 'BD' },
  { name: 'Hoa Anh Tuấn', department: 'BD' },
  { name: 'Trần Bảo Trung', department: 'BD' },
  { name: 'Nguyễn Đình Duy', department: 'BD' },
  { name: 'Nguyễn Minh Trang', department: 'BD' },
  { name: 'Vũ Thành Long', department: 'BD' },
  { name: 'Phạm Mai Anh', department: 'BD' },
];

const membersPM = [
  { name: "Mr. David", account: "David96" },
  { name: "Mr. Nguyên", account: "Nguyen" },
  { name: "Mr. Lucas", account: "Lucas" },
  { name: "Mr. Conal", account: "Conal" },
  { name: "Mr. Arthur", account: "Arthur" },
  { name: "Ms. Hano", account: "Hano" },
  { name: "Mr. Tony Fin", account: "TonyFin" },
  { name: "Mr. Hiếu Nguyễn", account: "HieuNguyen" }
];

const evaluate = [
  { name: 'Hoàn thành nhiệm vụ được giao', max_point: 10, type: EvaluateType.PM, category: EvaluateCategory.ACHIEVEMENT_POINTS, order: 1 },
  { name: 'Chủ động đóng góp sáng kiến (+2điểm/lần)', max_point: 10, type: EvaluateType.PM, category: EvaluateCategory.ACHIEVEMENT_POINTS, order: 2 },
  { name: 'Đảm bảo chất lượng công việc (bug; không gây thiệt hại;...)', max_point: 10, type: EvaluateType.PM, category: EvaluateCategory.ACHIEVEMENT_POINTS, order: 3 },
  { name: 'Thực hiện nhiều dự án cùng lúc (+2 điểm/dự án)', max_point: 10, type: EvaluateType.PM, category: EvaluateCategory.ACHIEVEMENT_POINTS, order: 4 },
  { name: 'Hoàn thành trước KPI (thời gian, hiệu suất,...)', max_point: 5, type: EvaluateType.PM, category: EvaluateCategory.ACHIEVEMENT_POINTS, order: 5 },
  { name: 'Hỗ trợ team khác', max_point: 5, type: EvaluateType.PM, category: EvaluateCategory.ACHIEVEMENT_POINTS, order: 6 },
  { name: 'Nhận xét của PM', max_point: 0, type: EvaluateType.PM, category: EvaluateCategory.ACHIEVEMENT_POINTS, order: 7 },
];

const evaluateHR = [
  { name: 'Hoà đồng gắn kết ( tối đa 10 điểm)', max_point: 10, type: EvaluateType.HR, category: EvaluateCategory.ATTITUDE_POINTS, order: 8 },
  { name: 'Tích cực tham gia các hoạt động chung (tối đa 5 điểm)', max_point: 5, type: EvaluateType.HR, category: EvaluateCategory.ATTITUDE_POINTS, order: 9 },
  { name: 'Giu gìn vệ sinh chung ( tối đa 5 điểm)- vi phạm trừ 1 điểm', max_point: 5, type: EvaluateType.HR, category: EvaluateCategory.ATTITUDE_POINTS, order: 10 },
  { name: 'Tuân thủ giờ làm ( tối đa 10 điểm)', max_point: 10, type: EvaluateType.HR, category: EvaluateCategory.SPECIAL_REQUIREMENTS, order: 11 },
  { name: 'Họp, OT (tối đa 5 điểm)', max_point: 5, type: EvaluateType.HR, category: EvaluateCategory.SPECIAL_REQUIREMENTS, order: 12 },
  { name: 'Nghỉ phép (tối đa 10 điểm)', max_point: 10, type: EvaluateType.HR, category: EvaluateCategory.SPECIAL_REQUIREMENTS, order: 13 },
  { name: 'Chấm công ( tối đa 5 điểm)', max_point: 5, type: EvaluateType.HR, category: EvaluateCategory.SPECIAL_REQUIREMENTS, order: 14 },
];


const _evaluateHR = [
  { name: 'Hoà đồng gắn kết ( tối đa 10 điểm)', max_point: 10, category: EvaluateCategory.ATTITUDE_POINTS, order: 8 },
  { name: 'Tích cực tham gia các hoạt động chung (tối đa 5 điểm)', max_point: 5, category: EvaluateCategory.ATTITUDE_POINTS, order: 9 },
  { name: 'Giu gìn vệ sinh chung ( tối đa 5 điểm)- vi phạm trừ 1 điểm', max_point: 5, type: EvaluateType.HR, category: EvaluateCategory.ATTITUDE_POINTS, order: 10 },
  { name: 'Tuân thủ giờ làm ( tối đa 10 điểm)', max_point: 10, category: EvaluateCategory.SPECIAL_REQUIREMENTS, order: 11 },
  { name: 'Họp, OT (tối đa 5 điểm)', max_point: 5, category: EvaluateCategory.SPECIAL_REQUIREMENTS, order: 12 },
  { name: 'Nghỉ phép (tối đa 10 điểm)', max_point: 10, category: EvaluateCategory.SPECIAL_REQUIREMENTS, order: 13 },
  { name: 'Chấm công ( tối đa 5 điểm)', max_point: 5, category: EvaluateCategory.SPECIAL_REQUIREMENTS, order: 14 },
];

@Injectable()
export class SeedDatabase implements OnApplicationBootstrap {
  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(EvaluateRepository)
  private readonly evaluateRepository: EvaluateRepository;

  constructor() {}

  async seedEvaluate() {
    await this.evaluateRepository.upsert(evaluate, {
      conflictPaths: ['order'],
    });

    await this.evaluateRepository.upsert(evaluateHR, {
      conflictPaths: ['order'],
    });
  }

  async seedMembersPM() {
    const updatedMembersPM = membersPM.map((member) => ({
      role: UserRole.PM,
      system_username: member.name,
      account: member.account,
      department: Department.PM,
    }));

    await this.userRepository.upsert(updatedMembersPM, {
      conflictPaths: ['account'],
    });
  }

  async seedMembers() {
    const generateAccount = (name) => {
      let parts = name.split(" ");
      if (parts.length < 2) return name;
    
      let lastName = parts[parts.length - 1];
      let initials = parts.slice(0, parts.length - 1).map(w => w[0]).join("");
    
      return `${lastName}${initials}`;
    };

    const mapToDepartment = (departmentStr: string): Department => {
      const upperDept = departmentStr.toUpperCase();
      return Department[upperDept] || Department.DEV;
    };

    const updatedMembers = members.map((member) => ({
      system_username: member.name,
      department: mapToDepartment(member.department),
      account: generateAccount(member.name),
    }));

    await this.userRepository.upsert(updatedMembers, {
      conflictPaths: ['account'],
    });
  }

  // export enum EvaluateCategory {
  //   // ĐIỂM THÀNH TÍCH
  //   ACHIEVEMENT_POINTS = 'ACHIEVEMENT_POINTS',
  //   // Điểm ý thức thái độ 
  //   ATTITUDE_POINTS = 'ATTITUDE_POINTS',
  //   // Điểm chuyên cần
  //   SPECIAL_REQUIREMENTS = 'SPECIAL_REQUIREMENTS',
  // }
  


  async onApplicationBootstrap() {
    const isWorker = Boolean(Number(process.env.IS_WORKER || 0));
    if (!isWorker) {
      return;
    }

    const data = _evaluateHR.map((item) => ({
      ...item,
      id: item.order,
      title: item.name,
      maxOptions: item.max_point,
      currentPoints: null,
      type: 'number'
    }));
    console.log('data', data);

    const start = Date.now();

    await this.seedEvaluate();
    await this.seedMembers();
    await this.seedMembersPM();

    const end = Date.now();

    console.log('Time to seed database', (end - start) / 1000);

    console.log('-----------SEED DATABASE SUCCESSFULLY----------------');
  }
}
