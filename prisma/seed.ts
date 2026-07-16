import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function toJson(value: unknown): string {
  return JSON.stringify(value);
}

async function main() {
  await prisma.session.deleteMany();
  await prisma.approvalRecord.deleteMany();
  await prisma.workflowInstance.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.mailRecipient.deleteMany();
  await prisma.internalMail.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.knowledgeCorrection.deleteMany();
  await prisma.assistantHistory.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.updateMany({
    data: {
      departmentId: null,
      managerId: null
    }
  });
  await prisma.department.deleteMany({
    where: {
      id: {
        in: ['d-rd-web', 'd-rd-back', 'd-rd-qa', 'd-it-ops', 'd-it-sec', 'd-sales-east', 'd-sales-south', 'd-ops-cs', 'd-proc-admin']
      }
    }
  });
  await prisma.department.deleteMany({
    where: {
      id: {
        in: ['d-rd', 'd-it', 'd-sales', 'd-ops', 'd-hr', 'd-fin', 'd-proc', 'd-knowledge']
      }
    }
  });
  await prisma.department.deleteMany({ where: { id: 'd-exec' } });
  await prisma.workflowTemplate.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.knowledgeCategory.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('123456', 10);

  await prisma.department.createMany({
    data: [
      { id: 'd-exec', name: '总裁办', parentId: null, leaderId: null, sortOrder: 1, status: 'active' },
      { id: 'd-rd', name: '产品研发部', parentId: 'd-exec', leaderId: null, sortOrder: 2, status: 'active' },
      { id: 'd-rd-web', name: '前端开发组', parentId: 'd-rd', leaderId: null, sortOrder: 1, status: 'active' },
      { id: 'd-rd-back', name: '后端开发组', parentId: 'd-rd', leaderId: null, sortOrder: 2, status: 'active' },
      { id: 'd-rd-qa', name: '测试与质量组', parentId: 'd-rd', leaderId: null, sortOrder: 3, status: 'active' },
      { id: 'd-it', name: '信息化管理部', parentId: 'd-exec', leaderId: null, sortOrder: 3, status: 'active' },
      { id: 'd-it-ops', name: '基础设施组', parentId: 'd-it', leaderId: null, sortOrder: 1, status: 'active' },
      { id: 'd-it-sec', name: '安全合规组', parentId: 'd-it', leaderId: null, sortOrder: 2, status: 'active' },
      { id: 'd-sales', name: '销售中心', parentId: 'd-exec', leaderId: null, sortOrder: 4, status: 'active' },
      { id: 'd-sales-east', name: '华东销售组', parentId: 'd-sales', leaderId: null, sortOrder: 1, status: 'active' },
      { id: 'd-sales-south', name: '华南销售组', parentId: 'd-sales', leaderId: null, sortOrder: 2, status: 'active' },
      { id: 'd-ops', name: '客户成功中心', parentId: 'd-exec', leaderId: null, sortOrder: 5, status: 'active' },
      { id: 'd-ops-cs', name: '客户成功组', parentId: 'd-ops', leaderId: null, sortOrder: 1, status: 'active' },
      { id: 'd-hr', name: '人力资源部', parentId: 'd-exec', leaderId: null, sortOrder: 6, status: 'active' },
      { id: 'd-fin', name: '财务部', parentId: 'd-exec', leaderId: null, sortOrder: 7, status: 'active' },
      { id: 'd-proc', name: '采购与行政部', parentId: 'd-exec', leaderId: null, sortOrder: 8, status: 'active' },
      { id: 'd-proc-admin', name: '行政组', parentId: 'd-proc', leaderId: null, sortOrder: 1, status: 'active' },
      { id: 'd-knowledge', name: '知识运营组', parentId: 'd-exec', leaderId: null, sortOrder: 9, status: 'active' }
    ]
  });

  await prisma.user.createMany({
    data: [
      {
        id: 'u1',
        name: '张晓宁',
        account: 'employee01',
        passwordHash,
        department: '产品研发部',
        departmentId: 'd-rd',
        managerId: 'u2',
        jobTitle: '产品经理',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '普通员工',
        permissionsJson: toJson(['知识查询', '收藏知识', '发起流程', '查看我的流程', '参与需求评审']),
        favoriteKnowledgeIdsJson: toJson(['k2', 'k4']),
        recentKnowledgeIdsJson: toJson(['k1', 'k2', 'k3']),
        todoCount: 2
      },
      {
        id: 'u2',
        name: '李清越',
        account: 'manager01',
        passwordHash,
        department: '产品研发部',
        departmentId: 'd-rd',
        managerId: 'u20',
        jobTitle: '研发中心负责人',
        employmentStatus: 'active',
        role: 'approver',
        roleLabel: '审批人',
        permissionsJson: toJson(['知识查询', '发起流程', '处理待办', '查看关联制度', '组织协调']),
        favoriteKnowledgeIdsJson: toJson(['k1']),
        recentKnowledgeIdsJson: toJson(['k2', 'k4']),
        todoCount: 5
      },
      {
        id: 'u3',
        name: '周承安',
        account: 'admin01',
        passwordHash,
        department: '信息化管理部',
        departmentId: 'd-it',
        managerId: 'u20',
        jobTitle: 'IT平台主管',
        employmentStatus: 'active',
        role: 'systemAdmin',
        roleLabel: '系统管理员',
        permissionsJson: toJson(['知识管理', '用户角色管理', '流程模板管理', '查看操作日志', '安全确认', '资产盘点']),
        favoriteKnowledgeIdsJson: toJson(['k3']),
        recentKnowledgeIdsJson: toJson(['k1', 'k5']),
        todoCount: 3
      },
      {
        id: 'u4',
        name: '林知夏',
        account: 'knowledge01',
        passwordHash,
        department: '知识运营组',
        departmentId: 'd-knowledge',
        managerId: 'u20',
        jobTitle: '知识运营负责人',
        employmentStatus: 'active',
        role: 'knowledgeAdmin',
        roleLabel: '知识管理员',
        permissionsJson: toJson(['知识管理', '知识分类维护', '知识发布下架', '查看审计摘要', '培训素材维护']),
        favoriteKnowledgeIdsJson: toJson(['k2', 'k5']),
        recentKnowledgeIdsJson: toJson(['k5', 'k2']),
        todoCount: 1
      },
      {
        id: 'u5',
        name: '王晨曦',
        account: 'frontend01',
        passwordHash,
        department: '前端开发组',
        departmentId: 'd-rd-web',
        managerId: 'u2',
        jobTitle: '前端开发工程师',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '前端工程师',
        permissionsJson: toJson(['知识查询', '发起流程', '查看我的流程', '代码规范自查']),
        favoriteKnowledgeIdsJson: toJson(['k5']),
        recentKnowledgeIdsJson: toJson(['k4', 'k5']),
        todoCount: 1
      },
      {
        id: 'u6',
        name: '陈思远',
        account: 'backend01',
        passwordHash,
        department: '后端开发组',
        departmentId: 'd-rd-back',
        managerId: 'u2',
        jobTitle: '后端开发工程师',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '后端工程师',
        permissionsJson: toJson(['知识查询', '发起流程', '查看我的流程', '接口联调']),
        favoriteKnowledgeIdsJson: toJson(['k5']),
        recentKnowledgeIdsJson: toJson(['k1', 'k5']),
        todoCount: 1
      },
      {
        id: 'u7',
        name: '赵子涵',
        account: 'qa01',
        passwordHash,
        department: '测试与质量组',
        departmentId: 'd-rd-qa',
        managerId: 'u2',
        jobTitle: '测试工程师',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '测试工程师',
        permissionsJson: toJson(['知识查询', '发起流程', '查看我的流程', '缺陷验证']),
        favoriteKnowledgeIdsJson: toJson(['k5']),
        recentKnowledgeIdsJson: toJson(['k1', 'k4']),
        todoCount: 1
      },
      {
        id: 'u8',
        name: '孙若琳',
        account: 'itops01',
        passwordHash,
        department: '基础设施组',
        departmentId: 'd-it-ops',
        managerId: 'u3',
        jobTitle: 'IT 运维工程师',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: 'IT 运维',
        permissionsJson: toJson(['知识查询', '发起流程', '查看我的流程', '设备巡检']),
        favoriteKnowledgeIdsJson: toJson(['k4']),
        recentKnowledgeIdsJson: toJson(['k4', 'k1']),
        todoCount: 1
      },
      {
        id: 'u9',
        name: '许景行',
        account: 'security01',
        passwordHash,
        department: '安全合规组',
        departmentId: 'd-it-sec',
        managerId: 'u3',
        jobTitle: '安全合规专员',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '安全专员',
        permissionsJson: toJson(['知识查询', '安全复核', '查看我的流程', '权限巡检']),
        favoriteKnowledgeIdsJson: toJson(['k4']),
        recentKnowledgeIdsJson: toJson(['k4', 'k2']),
        todoCount: 1
      },
      {
        id: 'u10',
        name: '刘雅琴',
        account: 'hr01',
        passwordHash,
        department: '人力资源部',
        departmentId: 'd-hr',
        managerId: 'u20',
        jobTitle: '人力资源总监',
        employmentStatus: 'active',
        role: 'approver',
        roleLabel: '审批人',
        permissionsJson: toJson(['招聘管理', '入转调离', '考勤查看', '流程审批', '制度发布']),
        favoriteKnowledgeIdsJson: toJson(['k1', 'k6']),
        recentKnowledgeIdsJson: toJson(['k1', 'k6']),
        todoCount: 4
      },
      {
        id: 'u11',
        name: '郑博文',
        account: 'finance01',
        passwordHash,
        department: '财务部',
        departmentId: 'd-fin',
        managerId: 'u20',
        jobTitle: '财务经理',
        employmentStatus: 'active',
        role: 'approver',
        roleLabel: '审批人',
        permissionsJson: toJson(['报销审核', '预算查看', '流程审批', '账期提醒']),
        favoriteKnowledgeIdsJson: toJson(['k2', 'k3']),
        recentKnowledgeIdsJson: toJson(['k2', 'k3']),
        todoCount: 4
      },
      {
        id: 'u12',
        name: '黄思敏',
        account: 'sales01',
        passwordHash,
        department: '销售中心',
        departmentId: 'd-sales',
        managerId: 'u20',
        jobTitle: '销售总监',
        employmentStatus: 'active',
        role: 'approver',
        roleLabel: '审批人',
        permissionsJson: toJson(['客户跟进', '报价审批', '合同查看', '流程审批']),
        favoriteKnowledgeIdsJson: toJson(['k2', 'k5']),
        recentKnowledgeIdsJson: toJson(['k2', 'k5']),
        todoCount: 4
      },
      {
        id: 'u13',
        name: '马可',
        account: 'cs01',
        passwordHash,
        department: '客户成功中心',
        departmentId: 'd-ops',
        managerId: 'u20',
        jobTitle: '客户成功中心负责人',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '客户成功负责人',
        permissionsJson: toJson(['客户回访', '知识查询', '发起流程', '查看我的流程', '客户满意度跟踪']),
        favoriteKnowledgeIdsJson: toJson(['k1', 'k5']),
        recentKnowledgeIdsJson: toJson(['k5', 'k2']),
        todoCount: 0
      },
      {
        id: 'u14',
        name: '周子墨',
        account: 'cs02',
        passwordHash,
        department: '客户成功组',
        departmentId: 'd-ops-cs',
        managerId: 'u13',
        jobTitle: '客户成功主管',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '客户成功主管',
        permissionsJson: toJson(['客户拜访', '知识查询', '发起流程', '查看我的流程']),
        favoriteKnowledgeIdsJson: toJson(['k1', 'k5']),
        recentKnowledgeIdsJson: toJson(['k1', 'k5']),
        todoCount: 0
      },
      {
        id: 'u15',
        name: '唐雨桐',
        account: 'procurement01',
        passwordHash,
        department: '采购与行政部',
        departmentId: 'd-proc',
        managerId: 'u20',
        jobTitle: '采购与行政部负责人',
        employmentStatus: 'active',
        role: 'approver',
        roleLabel: '审批人',
        permissionsJson: toJson(['采购申请', '供应商比价', '流程审批', '行政协调']),
        favoriteKnowledgeIdsJson: toJson(['k3', 'k5']),
        recentKnowledgeIdsJson: toJson(['k3', 'k5']),
        todoCount: 4
      },
      {
        id: 'u16',
        name: '罗嘉',
        account: 'office01',
        passwordHash,
        department: '行政组',
        departmentId: 'd-proc-admin',
        managerId: 'u15',
        jobTitle: '行政主管',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '行政主管',
        permissionsJson: toJson(['办公用品领用', '会议室预订', '发起流程', '查看我的流程', '访客管理']),
        favoriteKnowledgeIdsJson: toJson(['k1']),
        recentKnowledgeIdsJson: toJson(['k1', 'k3']),
        todoCount: 0
      },
      {
        id: 'u17',
        name: '何子怡',
        account: 'sales-east01',
        passwordHash,
        department: '华东销售组',
        departmentId: 'd-sales-east',
        managerId: 'u12',
        jobTitle: '区域销售代表',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '销售代表',
        permissionsJson: toJson(['客户跟进', '报价申请', '发起流程', '查看我的流程']),
        favoriteKnowledgeIdsJson: toJson(['k2']),
        recentKnowledgeIdsJson: toJson(['k2', 'k5']),
        todoCount: 0
      },
      {
        id: 'u18',
        name: '叶启明',
        account: 'sales-south01',
        passwordHash,
        department: '华南销售组',
        departmentId: 'd-sales-south',
        managerId: 'u12',
        jobTitle: '区域销售代表',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '销售代表',
        permissionsJson: toJson(['客户跟进', '报价申请', '发起流程', '查看我的流程']),
        favoriteKnowledgeIdsJson: toJson(['k2']),
        recentKnowledgeIdsJson: toJson(['k2', 'k5']),
        todoCount: 0
      },
      {
        id: 'u19',
        name: '彭晓峰',
        account: 'knowledgeeditor01',
        passwordHash,
        department: '知识运营组',
        departmentId: 'd-knowledge',
        managerId: 'u4',
        jobTitle: '知识编辑',
        employmentStatus: 'active',
        role: 'employee',
        roleLabel: '知识编辑',
        permissionsJson: toJson(['知识查询', '知识校对', '提交修订建议', '查看我的流程']),
        favoriteKnowledgeIdsJson: toJson(['k4', 'k5']),
        recentKnowledgeIdsJson: toJson(['k4', 'k5']),
        todoCount: 0
      },
      {
        id: 'u20',
        name: '许昭远',
        account: 'ceo01',
        passwordHash,
        department: '总裁办',
        departmentId: 'd-exec',
        managerId: null,
        jobTitle: '总经理',
        employmentStatus: 'active',
        role: 'approver',
        roleLabel: '总经理',
        permissionsJson: toJson(['组织管理', '战略审批', '流程审批', '经营看板', '安全确认']),
        favoriteKnowledgeIdsJson: toJson(['k5', 'k6']),
        recentKnowledgeIdsJson: toJson(['k5', 'k6']),
        todoCount: 6
      }
    ]
  });

  await prisma.knowledgeCategory.createMany({
    data: [
      { id: 'all', name: '全部', description: '查看所有已发布知识', sortOrder: 0 },
      { id: 'c1', name: '行政人事', description: '请假、考勤与入职相关制度', sortOrder: 1 },
      { id: 'c2', name: '财务报销', description: '差旅、发票与费用标准', sortOrder: 2 },
      { id: 'c3', name: '采购管理', description: '采购申请与合同审批规范', sortOrder: 3 },
      { id: 'c4', name: 'IT 支持', description: '账号权限与设备申请指南', sortOrder: 4 },
      { id: 'c5', name: '项目资料', description: '项目规范与开发文档', sortOrder: 5 },
      { id: 'c6', name: '培训材料', description: '培训课件与经验沉淀', sortOrder: 6 }
    ]
  });

  await prisma.knowledgeArticle.createMany({
    data: [
      {
        id: 'k1',
        title: '请假制度说明',
        summary: '说明年假、事假、病假的申请入口、审批要求与材料规范。',
        content: '员工请假需提前发起申请，病假需补充证明材料。超过 3 天的请假需要部门负责人审批，并同步更新团队排期。',
        categoryId: 'c1',
        categoryName: '行政人事',
        tagsJson: toJson(['请假', '考勤', '制度']),
        updateTime: '2026-07-10',
        version: 'v1.2',
        status: 'published',
        attachmentsJson: toJson(['请假流程图.pdf']),
        relatedWorkflowIdsJson: toJson(['wf1'])
      },
      {
        id: 'k2',
        title: '差旅报销制度',
        summary: '覆盖差旅发票、住宿、交通与打车报销所需材料及额度标准。',
        content: '报销打车费需上传发票、行程截图和事由说明。单笔超 5000 元的报销申请需要二次安全确认并留痕。',
        categoryId: 'c2',
        categoryName: '财务报销',
        tagsJson: toJson(['报销', '发票', '差旅']),
        updateTime: '2026-07-09',
        version: 'v2.1',
        status: 'published',
        attachmentsJson: toJson(['报销材料清单.xlsx']),
        relatedWorkflowIdsJson: toJson(['wf2'])
      },
      {
        id: 'k3',
        title: '采购申请规范',
        summary: '描述采购申请、预算填写、供应商比选与合同审批注意事项。',
        content: '采购申请需要明确用途、预算、期望到货时间。涉及固定资产采购时，需要补充资产归属说明与验收负责人。',
        categoryId: 'c3',
        categoryName: '采购管理',
        tagsJson: toJson(['采购', '预算', '合同']),
        updateTime: '2026-07-08',
        version: 'v1.5',
        status: 'published',
        attachmentsJson: toJson(['采购模板.docx']),
        relatedWorkflowIdsJson: toJson(['wf3'])
      },
      {
        id: 'k4',
        title: '系统权限申请规范',
        summary: '介绍企业系统账号、权限开通、回收与审批节点要求。',
        content: '申请系统权限时需说明业务场景、系统名称、期限范围和直属负责人。敏感系统权限会附加安全确认步骤。',
        categoryId: 'c4',
        categoryName: 'IT 支持',
        tagsJson: toJson(['权限', '账号', 'IT']),
        updateTime: '2026-07-11',
        version: 'v1.1',
        status: 'published',
        attachmentsJson: toJson(['权限矩阵表.xlsx']),
        relatedWorkflowIdsJson: toJson(['wf4'])
      },
      {
        id: 'k5',
        title: '项目交付文档模板',
        summary: '整理项目开发、测试、上线交付所需的文档清单与版本要求。',
        content: '项目交付前需要补齐需求文档、测试报告、上线说明和回滚预案。文档应统一归档到项目资料知识库中。',
        categoryId: 'c5',
        categoryName: '项目资料',
        tagsJson: toJson(['项目', '交付', '文档']),
        updateTime: '2026-07-07',
        version: 'v1.0',
        status: 'published',
        attachmentsJson: toJson(['交付材料清单.zip']),
        relatedWorkflowIdsJson: toJson([])
      }
    ]
  });

  await prisma.workflowTemplate.createMany({
    data: [
      {
        id: 'wf1',
        name: '请假申请',
        description: '填写请假类型、时间与原因，提交给部门负责人审批。',
        approverText: '部门负责人',
        relatedKnowledgeIdsJson: toJson(['k1']),
        riskLevel: 'normal',
        riskHint: '常规人员流程，无需额外安全确认。',
        defaultApproverRolesJson: toJson(['approver'])
      },
      {
        id: 'wf2',
        name: '报销申请',
        description: '填写费用类型、金额、事由并上传材料，支持高金额安全确认。',
        approverText: '部门负责人 / 财务复核',
        relatedKnowledgeIdsJson: toJson(['k2']),
        riskLevel: 'high',
        riskHint: '金额超过 5000 元会触发二次安全确认和审计留痕。',
        defaultApproverRolesJson: toJson(['approver', 'systemAdmin'])
      },
      {
        id: 'wf3',
        name: '采购申请',
        description: '填写采购物品、预算、用途和期望到货时间。',
        approverText: '部门负责人 / 采购复核',
        relatedKnowledgeIdsJson: toJson(['k3']),
        riskLevel: 'high',
        riskHint: '高金额采购需进行风险检测并走二次确认。',
        defaultApproverRolesJson: toJson(['approver', 'systemAdmin'])
      },
      {
        id: 'wf4',
        name: '权限申请',
        description: '申请业务系统账号或访问权限，可预填申请说明。',
        approverText: '部门负责人 / 系统管理员',
        relatedKnowledgeIdsJson: toJson(['k4']),
        riskLevel: 'normal',
        riskHint: '敏感系统账号会由系统管理员完成最终开通确认。',
        defaultApproverRolesJson: toJson(['approver', 'systemAdmin'])
      }
    ]
  });

  await prisma.workflowInstance.create({
    data: {
      id: 'i1',
      templateId: 'wf2',
      title: '差旅报销 - 华南客户拜访',
      applicantId: 'u1',
      applicantName: '张晓宁',
      status: 'pending',
      currentNode: '等待部门负责人审批',
      currentApproverRole: 'approver',
      createTime: '2026-07-12 09:20',
      latestComment: '已提交，等待审批。',
      relatedKnowledgeIdsJson: toJson(['k2']),
      amount: 3680,
      formSummary: '打车与住宿报销，需补充电子发票和行程截图。',
      formDetailJson: toJson(['费用类型：差旅', '报销金额：3680 元', '事由：华南客户拜访', '附件：发票+行程截图']),
      riskLevel: 'normal',
      riskReason: '',
      requiresSecurityConfirm: false,
      securityConfirmed: false,
      approvalRecords: {
        create: [
          {
            id: 'ar1',
            nodeName: '提交流程',
            operatorRole: 'employee',
            operatorName: '张晓宁',
            decision: 'submitted',
            comment: '已提交差旅报销材料。',
            time: '2026-07-12 09:20'
          }
        ]
      }
    }
  });

  await prisma.workflowInstance.create({
    data: {
      id: 'i2',
      templateId: 'wf4',
      title: '权限申请 - 项目看板访问',
      applicantId: 'u1',
      applicantName: '张晓宁',
      status: 'in_review',
      currentNode: '等待系统管理员确认',
      currentApproverRole: 'systemAdmin',
      createTime: '2026-07-11 15:30',
      latestComment: '部门负责人已通过，待系统管理员开通。',
      relatedKnowledgeIdsJson: toJson(['k4']),
      amount: 0,
      formSummary: '申请项目看板访问权限，用于跟进版本发布。',
      formDetailJson: toJson(['系统名称：项目看板', '使用期限：2026-07 至 2026-12', '业务场景：版本发布跟踪', '附件：权限矩阵截图']),
      riskLevel: 'normal',
      riskReason: '',
      requiresSecurityConfirm: false,
      securityConfirmed: false,
      approvalRecords: {
        create: [
          {
            id: 'ar2',
            nodeName: '提交流程',
            operatorRole: 'employee',
            operatorName: '张晓宁',
            decision: 'submitted',
            comment: '申请项目看板访问权限。',
            time: '2026-07-11 15:30'
          },
          {
            id: 'ar3',
            nodeName: '部门负责人审批',
            operatorRole: 'approver',
            operatorName: '李清越',
            decision: 'approved',
            comment: '业务场景明确，同意流转至系统管理员。',
            time: '2026-07-11 16:20'
          }
        ]
      }
    }
  });

  await prisma.workflowInstance.create({
    data: {
      id: 'i3',
      templateId: 'wf3',
      title: '采购申请 - 新会议平板',
      applicantId: 'u2',
      applicantName: '李清越',
      status: 'pending_security_confirm',
      currentNode: '等待数字盾二次确认',
      currentApproverRole: 'systemAdmin',
      createTime: '2026-07-10 10:10',
      latestComment: '金额较高，已触发采购风险确认。',
      relatedKnowledgeIdsJson: toJson(['k3']),
      amount: 12800,
      formSummary: '采购会议平板 2 台，用于客户演示室升级。',
      formDetailJson: toJson(['采购物品：会议平板', '预算金额：12800 元', '用途：客户演示室升级', '期望到货：2026-07-20']),
      riskLevel: 'high',
      riskReason: '采购金额超过 10000 元，需进行二次确认。',
      requiresSecurityConfirm: true,
      securityConfirmed: false,
      approvalRecords: {
        create: [
          {
            id: 'ar4',
            nodeName: '提交流程',
            operatorRole: 'approver',
            operatorName: '李清越',
            decision: 'submitted',
            comment: '采购演示设备。',
            time: '2026-07-10 10:10'
          },
          {
            id: 'ar5',
            nodeName: '部门负责人审批',
            operatorRole: 'approver',
            operatorName: '李清越',
            decision: 'approved',
            comment: '预算合理，进入安全确认。',
            time: '2026-07-10 11:00'
          }
        ]
      }
    }
  });

  await prisma.attendanceRecord.createMany({
    data: [
      {
        id: 'at1',
        userId: 'u1',
        userName: '张晓宁',
        type: 'checkIn',
        time: '2026-07-16 08:56',
        location: '深圳南山办公区',
        note: '正常到岗',
        status: 'normal'
      },
      {
        id: 'at2',
        userId: 'u3',
        userName: '周承安',
        type: 'checkIn',
        time: '2026-07-16 08:32',
        location: '深圳总部科技园',
        note: '机房巡检前签到',
        status: 'normal'
      },
      {
        id: 'at3',
        userId: 'u10',
        userName: '刘雅琴',
        type: 'checkIn',
        time: '2026-07-16 08:47',
        location: '北京总部办公区',
        note: '晨会前到岗',
        status: 'normal'
      },
      {
        id: 'at4',
        userId: 'u12',
        userName: '黄思敏',
        type: 'checkIn',
        time: '2026-07-16 08:51',
        location: '广州分部会议室',
        note: '客户拜访前签到',
        status: 'normal'
      },
      {
        id: 'at5',
        userId: 'u20',
        userName: '许昭远',
        type: 'checkIn',
        time: '2026-07-16 08:20',
        location: '深圳总部大楼',
        note: '总部巡查',
        status: 'normal'
      }
    ]
  });

  await prisma.department.update({ where: { id: 'd-exec' }, data: { leaderId: 'u20' } });
  await prisma.department.update({ where: { id: 'd-rd' }, data: { leaderId: 'u2' } });
  await prisma.department.update({ where: { id: 'd-rd-web' }, data: { leaderId: 'u5' } });
  await prisma.department.update({ where: { id: 'd-rd-back' }, data: { leaderId: 'u6' } });
  await prisma.department.update({ where: { id: 'd-rd-qa' }, data: { leaderId: 'u7' } });
  await prisma.department.update({ where: { id: 'd-it' }, data: { leaderId: 'u3' } });
  await prisma.department.update({ where: { id: 'd-it-ops' }, data: { leaderId: 'u8' } });
  await prisma.department.update({ where: { id: 'd-it-sec' }, data: { leaderId: 'u9' } });
  await prisma.department.update({ where: { id: 'd-sales' }, data: { leaderId: 'u12' } });
  await prisma.department.update({ where: { id: 'd-sales-east' }, data: { leaderId: 'u17' } });
  await prisma.department.update({ where: { id: 'd-sales-south' }, data: { leaderId: 'u18' } });
  await prisma.department.update({ where: { id: 'd-ops' }, data: { leaderId: 'u13' } });
  await prisma.department.update({ where: { id: 'd-ops-cs' }, data: { leaderId: 'u14' } });
  await prisma.department.update({ where: { id: 'd-hr' }, data: { leaderId: 'u10' } });
  await prisma.department.update({ where: { id: 'd-fin' }, data: { leaderId: 'u11' } });
  await prisma.department.update({ where: { id: 'd-proc' }, data: { leaderId: 'u15' } });
  await prisma.department.update({ where: { id: 'd-proc-admin' }, data: { leaderId: 'u16' } });
  await prisma.department.update({ where: { id: 'd-knowledge' }, data: { leaderId: 'u4' } });

  await prisma.internalMail.create({
    data: {
      id: 'mail2',
      subject: '报销材料已补充，请查收',
      summary: '已补齐发票和行程截图，可直接进入审批。',
      content: '你的差旅报销材料已补充完整，包括电子发票、行程截图和事由说明。',
      senderId: 'u2',
      senderName: '李清越',
      importance: 'normal',
      createTime: '2026-07-15 10:12',
      relatedWorkflowId: 'i1',
      relatedKnowledgeId: 'k2',
      recipients: {
        create: {
          id: 'mail-recipient-1',
          userId: 'u1',
          userName: '张晓宁',
          read: false,
          readTime: ''
        }
      }
    }
  });

  await prisma.notification.createMany({
    data: [
      {
        id: 'n1',
        title: '报销申请待处理',
        content: '张晓宁提交了“差旅报销 - 华南客户拜访”，请尽快审批。',
        time: '10 分钟前',
        read: false,
        targetRolesJson: toJson(['approver']),
        targetType: 'workflow',
        targetId: 'i1'
      },
      {
        id: 'n2',
        title: '权限申请进入下一节点',
        content: '你的权限申请已由部门负责人通过，正在等待系统管理员处理。',
        time: '1 小时前',
        read: false,
        targetRolesJson: toJson(['employee']),
        targetType: 'workflow',
        targetId: 'i2'
      },
      {
        id: 'n3',
        title: '知识更新提醒',
        content: '《系统权限申请规范》已发布新版本 v1.1。',
        time: '今天',
        read: false,
        targetRolesJson: toJson(['knowledgeAdmin', 'systemAdmin']),
        targetType: 'knowledge',
        targetId: 'k4'
      },
      {
        id: 'n4',
        title: '高风险采购待二次确认',
        content: '“采购申请 - 新会议平板”已触发安全确认，请系统管理员处理。',
        time: '今天',
        read: true,
        targetRolesJson: toJson(['systemAdmin']),
        targetType: 'none',
        targetId: ''
      }
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      {
        id: 'log1',
        module: '流程审批',
        action: '提交报销申请',
        operatorName: '张晓宁',
        operatorRole: 'employee',
        riskLevel: 'normal',
        detail: '提交了“差旅报销 - 华南客户拜访”，材料待部门负责人审核。',
        time: '2026-07-12 09:20'
      },
      {
        id: 'log2',
        module: '安全治理',
        action: '触发采购风险检测',
        operatorName: '李清越',
        operatorRole: 'approver',
        riskLevel: 'high',
        detail: '采购金额 12800 元，系统要求进入二次安全确认流程。',
        time: '2026-07-10 11:00'
      },
      {
        id: 'log3',
        module: '系统管理',
        action: '查看权限申请',
        operatorName: '周承安',
        operatorRole: 'systemAdmin',
        riskLevel: 'normal',
        detail: '查看“权限申请 - 项目看板访问”的开通材料。',
        time: '2026-07-11 16:35'
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
