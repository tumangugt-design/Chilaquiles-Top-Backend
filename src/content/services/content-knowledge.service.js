import { BrandKnowledge } from '../models/BrandKnowledge.model.js';
import { ContentStandard } from '../models/ContentStandard.model.js';

export const saveBrandKnowledge = async (data) => {
  const bk = new BrandKnowledge(data);
  await bk.save();
  return bk;
};

export const getBrandKnowledge = async () => {
  return await BrandKnowledge.find({ status: 'active' });
};

export const saveContentStandard = async (data) => {
  const standard = new ContentStandard(data);
  await standard.save();
  return standard;
};

export const getContentStandards = async () => {
  return await ContentStandard.find({ active: true });
};
