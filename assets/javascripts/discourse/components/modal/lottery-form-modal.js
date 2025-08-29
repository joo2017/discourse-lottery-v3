import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { isBlank, isPresent } from "@ember/utils";
import { ajax } from "discourse/lib/ajax";

export default class LotteryFormModal extends Component {
  @service modal;
  @service site;
  @service appEvents;

  // 表单数据（使用 @tracked 进行响应式更新）
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";
  @tracked prizeImage = "";  
  @tracked prizeImagePreview = "";  
  @tracked isImageUploading = false;  
  
  // 状态管理
  @tracked isLoading = false;
  @tracked flash = "";
  @tracked flashType = "";
  @tracked validationErrors = {};

  constructor(owner, args) {
    super(owner, args);
    console.log("🎲 抽奖表单模态框组件初始化");
    console.log("🎲 传入的模型数据:", this.args.model);
    
    this.initializeDefaults();
  }

  initializeDefaults() {
    // 初始化最小参与人数
    const globalMin = this.args.model?.siteSettings?.lottery_min_participants_global || 5;
    this.minParticipants = globalMin;
    
    // 设置默认开奖时间（1小时后）
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    // 转换为本地时间字符串，移除秒和毫秒
    this.drawTime = new Date(defaultTime.getTime() - defaultTime.getTimezoneOffset() * 60000)
                    .toISOString().slice(0, 16);

    console.log("🎲 初始化完成，默认开奖时间:", this.drawTime);
    console.log("🎲 最小参与人数:", this.minParticipants);
  }

  // 表单验证
  get isValid() {
    this.validationErrors = {};
    let isValid = true;

    // 检查必填字段
    if (isBlank(this.prizeName)) {
      this.validationErrors.prizeName = "活动名称不能为空";
      isValid = false;
    } else if (this.prizeName.length > 100) {
      this.validationErrors.prizeName = "活动名称不能超过100个字符";
      isValid = false;
    }

    if (isBlank(this.prizeDetails)) {
      this.validationErrors.prizeDetails = "奖品说明不能为空";
      isValid = false;
    } else if (this.prizeDetails.length > 500) {
      this.validationErrors.prizeDetails = "奖品说明不能超过500个字符";
      isValid = false;
    }

    if (isBlank(this.drawTime)) {
      this.validationErrors.drawTime = "开奖时间不能为空";
      isValid = false;
    } else {
      const drawDate = new Date(this.drawTime);
      if (isNaN(drawDate.getTime())) {
        this.validationErrors.drawTime = "开奖时间格式无效";
        isValid = false;
      } else if (drawDate <= new Date()) {
        this.validationErrors.drawTime = "开奖时间必须是未来时间";
        isValid = false;
      }
    }

    // 验证参与门槛
    if (this.minParticipants < this.globalMinParticipants) {
      this.validationErrors.minParticipants = `参与门槛不能低于全局设置的 ${this.globalMinParticipants} 人`;
      isValid = false;
    }

    // 验证获奖人数
    if (this.winnersCount < 1) {
      this.validationErrors.winnersCount = "获奖人数必须至少为1";
      isValid = false;
    } else if (this.winnersCount > 100) {
      this.validationErrors.winnersCount = "获奖人数不能超过100";
      isValid = false;
    }

    // 验证指定楼层格式（如果填写了）
    if (isPresent(this.specifiedPosts)) {
      const posts = this.specifiedPosts.split(',').map(p => p.trim()).filter(p => p);
      const numbers = posts.map(p => parseInt(p)).filter(n => !isNaN(n) && n > 1);
      
      if (posts.length !== numbers.length || numbers.length === 0) {
        this.validationErrors.specifiedPosts = "指定楼层格式错误，请使用逗号分隔的数字";
        isValid = false;
      } else if (numbers.length !== [...new Set(numbers)].length) {
        this.validationErrors.specifiedPosts = "指定楼层不能包含重复数字";
        isValid = false;
      }
    }

    // 验证补充说明长度
    if (isPresent(this.additionalNotes) && this.additionalNotes.length > 300) {
      this.validationErrors.additionalNotes = "补充说明不能超过300个字符";
      isValid = false;
    }
    
    console.log("🎲 表单验证结果:", { isValid, errors: this.validationErrors });
    return isValid;
  }

  // 获取全局最小参与人数
  get globalMinParticipants() {
    return this.args.model?.siteSettings?.lottery_min_participants_global || 5;
  }

  // 显示 flash 消息
  @action
  showFlash(message, type = "error") {
    console.log("🎲 显示 flash 消息:", message, type);
    this.flash = message;
    this.flashType = type;
    
    // 自动清除成功消息
    if (type === "success") {
      setTimeout(() => {
        this.clearFlash();
      }, 3000);
    }
  }

  // 清除 flash 消息
  @action
  clearFlash() {
    this.flash = "";
    this.flashType = "";
  }

  // 更新表单字段的方法
  @action
  updatePrizeName(event) {
    this.prizeName = event.target.value;
    this.clearFlash();
    delete this.validationErrors.prizeName;
  }

  @action
  updatePrizeDetails(event) {
    this.prizeDetails = event.target.value;
    this.clearFlash();
    delete this.validationErrors.prizeDetails;
  }

  @action
  updateDrawTime(event) {
    this.drawTime = event.target.value;
    this.clearFlash();
    delete this.validationErrors.drawTime;
  }

  @action
  updateWinnersCount(event) {
    const value = parseInt(event.target.value);
    this.winnersCount = isNaN(value) ? 1 : Math.max(1, Math.min(100, value));
    delete this.validationErrors.winnersCount;
  }

  @action
  updateSpecifiedPosts(event) {
    this.specifiedPosts = event.target.value;
    delete this.validationErrors.specifiedPosts;
  }

  @action
  updateMinParticipants(event) {
    const value = parseInt(event.target.value);
    this.minParticipants = isNaN(value) ? this.globalMinParticipants : Math.max(value, this.globalMinParticipants);
    this.clearFlash();
    delete this.validationErrors.minParticipants;
  }

  @action
  updateBackupStrategy(event) {
    this.backupStrategy = event.target.value;
  }

  @action
  updateAdditionalNotes(event) {
    this.additionalNotes = event.target.value;
    delete this.validationErrors.additionalNotes;
  }

  // 处理图片上传 - 修正版本
  @action
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      this.showFlash("请选择图片文件", "error");
      return;
    }

    // 验证文件大小 (3MB)
    if (file.size > 3 * 1024 * 1024) {
      this.showFlash("图片文件大小不能超过 3MB", "error");
      return;
    }

    this.isImageUploading = true;
    console.log("🎲 开始上传图片:", file.name);

    try {
      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        this.prizeImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);

      // 使用 discourse/lib/ajax 进行上传
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_type', 'composer'); // 修正：使用 upload_type 而不是 type

      const response = await ajax('/uploads.json', {
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false
      });

      if (response && response.url) {
        this.prizeImage = response.url;
        console.log("🎲 图片上传成功:", this.prizeImage);
        this.showFlash("图片上传成功", "success");
      } else {
        throw new Error('上传响应格式错误');
      }
    } catch (error) {
      console.error("🎲 图片上传失败:", error);
      this.showFlash("图片上传失败，请重试", "error");
      this.prizeImagePreview = "";
    } finally {
      this.isImageUploading = false;
    }
  }

  // 移除图片
  @action
  removeImage() {
    this.prizeImage = "";
    this.prizeImagePreview = "";
    // 清除文件输入框
    const fileInput = document.getElementById('lottery-image-upload');
    if (fileInput) {
      fileInput.value = '';
    }
    console.log("🎲 移除图片");
  }

  // 提交表单 - 修正版本
  @action
  async submit() {
    console.log("🎲 开始提交抽奖表单");
    this.clearFlash();

    if (!this.isValid) {
      const firstErrorKey = Object.keys(this.validationErrors)[0];
      const firstError = this.validationErrors[firstErrorKey];
      this.showFlash(firstError, "error");
      return;
    }

    this.isLoading = true;
    console.log("🎲 开始处理表单提交，设置加载状态");

    try {
      // 构建抽奖数据
      const lotteryData = {
        prize_name: this.prizeName.trim(),
        prize_details: this.prizeDetails.trim(),
        draw_time: this.drawTime.trim(),
        winners_count: this.winnersCount,
        specified_posts: this.specifiedPosts.trim(),
        min_participants: this.minParticipants,
        backup_strategy: this.backupStrategy,
        additional_notes: this.additionalNotes.trim(),
        prize_image: this.prizeImage.trim()
      };

      console.log("🎲 构建的抽奖数据对象:", lotteryData);

      // 将抽奖数据保存到 composer model 的 custom_fields
      const composer = this.args.model?.composer;
      console.log("🎲 获取编辑器实例:", composer);
      
      if (composer && composer.get) {
        const model = composer.get("model");
        
        // 确保 custom_fields 存在
        if (!model.custom_fields) {
          model.set("custom_fields", {});
        }
        
        // 保存抽奖数据到 custom_fields
        model.set("custom_fields.lottery", JSON.stringify(lotteryData));
        model.notifyPropertyChange("custom_fields");
        
        // 构建并插入显示内容
        const placeholder = this.buildLotteryPlaceholder(lotteryData);
        const currentText = model.get("reply") || "";
        model.set("reply", currentText + placeholder);

        console.log("🎲 抽奖内容成功插入到编辑器");
        console.log("🎲 Custom fields 已保存:", model.custom_fields);
        
        // 显示成功消息
        this.showFlash("抽奖信息已插入编辑器", "success");
        
        // 延迟关闭模态框，让用户看到成功提示
        setTimeout(() => {
          console.log("🎲 关闭模态框");
          this.args.closeModal();
        }, 1500);
      } else {
        console.error("🎲 无法获取编辑器实例");
        this.showFlash("无法获取编辑器，请刷新页面重试", "error");
      }
    } catch (error) {
      console.error("🎲 提交表单时发生错误:", error);
      this.showFlash("提交失败：" + error.message, "error");
    } finally {
      this.isLoading = false;
      console.log("🎲 清除加载状态");
    }
  }

  buildLotteryPlaceholder(lotteryData) {
    let placeholder = "\n[lottery]\n";
    placeholder += `活动名称：${lotteryData.prize_name}\n`;
    placeholder += `奖品说明：${lotteryData.prize_details}\n`;
    placeholder += `开奖时间：${lotteryData.draw_time}\n`;
    
    // 智能判断抽奖方式
    if (lotteryData.specified_posts && lotteryData.specified_posts.trim()) {
      placeholder += "抽奖方式：指定楼层\n";
      placeholder += `指定楼层：${lotteryData.specified_posts}\n`;
    } else {
      placeholder += "抽奖方式：随机抽取\n";
      placeholder += `获奖人数：${lotteryData.winners_count}\n`;
    }
    
    placeholder += `参与门槛：至少${lotteryData.min_participants}人参与\n`;
    
    if (lotteryData.additional_notes && lotteryData.additional_notes.trim()) {
      placeholder += `补充说明：${lotteryData.additional_notes}\n`;
    }
    
    if (lotteryData.prize_image && lotteryData.prize_image.trim()) {
      placeholder += `奖品图片：${lotteryData.prize_image}\n`;
    }
    
    placeholder += "[/lottery]\n\n";
    
    return placeholder;
  }

  @action
  cancel() {
    this.args.closeModal();
  }
}
