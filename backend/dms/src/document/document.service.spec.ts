import { Test, TestingModule } from '@nestjs/testing';
import { SharepointService } from './document.service';

describe('SharepointService', () => {
  let service: SharepointService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SharepointService],
    }).compile();

    service = module.get<SharepointService>(SharepointService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
