import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { UserRepository } from '@/database/repositories';
import { TJWTPayload } from '@/shared/types';

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async getNonce(address: string): Promise<string> {
    const normalizedAddress = address.toLowerCase();
    let user = await this.userRepository.findOne({
      where: { address: normalizedAddress },
    });

    const nonce = Math.floor(Math.random() * 1_000_000).toString();

    if (!user) {
      user = this.userRepository.create({ address: normalizedAddress, nonce });
      await this.userRepository.save(user);
    } else {
      await this.userRepository.update(user.id, { nonce });
    }

    return nonce;
  }

  async verifySignatureAndLogin(
    address: string,
    signature: string,
  ): Promise<{ accessToken: string; user: { id: string; address: string; username?: string; email?: string } }> {
    const normalizedAddress = address.toLowerCase();
    const user = await this.userRepository.findOne({
      where: { address: normalizedAddress },
    });

    if (!user || !user.nonce) {
      throw new NotFoundException('User not found. Request a nonce first.');
    }

    const message = `Sign this message to authenticate: ${user.nonce}`;
    let recoveredAddress: string;

    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature).toLowerCase();
    } catch {
      throw new UnauthorizedException('Invalid signature');
    }

    if (recoveredAddress !== normalizedAddress) {
      throw new UnauthorizedException('Signature does not match address');
    }

    // Invalidate nonce after use
    await this.userRepository.update(user.id, { nonce: null });

    const payload: TJWTPayload = { sub: user.id };
    const secret = this.configService.get<string>('auth.jwt.jwt_secret_key');
    const expiresIn = this.configService.get<number>('auth.jwt.access_token_lifetime');

    const accessToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        address: user.address,
        username: user.username,
        email: user.email,
      },
    };
  }
}
