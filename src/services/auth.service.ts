import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } from '@/configs';
import HTTP_STATUS from '@/constants/httpStatus';
import { SignUpUserDto, SignInUserDto, RefreshTokenDto } from '@/dtos';
import { HttpException } from '@/exceptions/httpException';
import { DataStoredInToken, ETokenType, IUser, TokenData, TokenPayload } from '@/interfaces';
import { User, UserInfo } from '@/models';
import { RefreshToken } from '@/models';
import { compare, hash } from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { Service } from 'typedi';

//generate token
const generateToken = (user: IUser, exp: number | string, type: ETokenType): TokenData => {
  const dataStoredInToken: DataStoredInToken = {
    id: user._id!.toString(),
    // role: user.,
    type: type,
  };

  return {
    expiresIn: exp,
    token: jwt.sign(dataStoredInToken, ACCESS_TOKEN_SECRET!, { expiresIn: exp }),
  };
};

@Service()
export class AuthRepository {
  public async signup(userData: SignUpUserDto): Promise<{ token: TokenPayload; signUpUserData: IUser }> {
    const findUserByEmail = await User.findOne({ email: userData.email });
    if (userData.password !== userData.confirmpassword) {
      throw new HttpException(HTTP_STATUS.CONFLICT, `Confirmpassword is not match`);
    }

    if (findUserByEmail) {
      throw new HttpException(HTTP_STATUS.UNPROCESSABLE_ENTITY, `This email already exists`);
    }

    const findUserByName = await User.findOne({ name: userData.name });
    if (findUserByName) {
      throw new HttpException(HTTP_STATUS.UNPROCESSABLE_ENTITY, `This name already exists`);
    }

    const hashedPassword = await hash(userData.password, 10);
    const user = await User.create({
      ...userData,
      avatar: '',
      password: hashedPassword,
    });

    const accessTokenExp = '8h';
    const { token: accessToken } = generateToken(user, accessTokenExp, ETokenType.ACCESS);

    const refreshTokenExp = '24h';
    const { token: refreshToken } = generateToken(user, refreshTokenExp, ETokenType.REFRESH);

    user.refreshToken = refreshToken;
    await user.save();

    const createInfo = await UserInfo.create({
      userId: user._id,
      streetAddress: '',
      postalCode: '',
      city: '',
      country: '',
      phone: '',
    });

    user.info = new ObjectId(createInfo.id);
    await user.save();

    const userLogout = await RefreshToken.findOne({ user_id: user._id });
    if (!userLogout) {
      await new RefreshToken({
        user_id: user._id,
        token: refreshToken,
      }).save();
    }

    return {
      token: { accessToken, refreshToken },
      signUpUserData: user,
    };
  }

  public async signin(userData: SignInUserDto): Promise<{ token: TokenPayload; user: IUser }> {
    const user = await User.findOne({ email: userData.email });
    if (!user) {
      throw new HttpException(HTTP_STATUS.NOT_FOUND, `This email was not found`);
    }

    const isPasswordMatching: boolean = await compare(userData.password, user.password);
    if (!isPasswordMatching) {
      throw new HttpException(HTTP_STATUS.CONFLICT, 'Password not matching');
    }

    if (user.isActive === false) {
      throw new HttpException(HTTP_STATUS.CONFLICT, `This user was disabled`);
    }

    const accessTokenExp = 60 * 60;
    const { token: accessToken } = generateToken(user, accessTokenExp, ETokenType.ACCESS);

    const refreshTokenExp = 24 * 60 * 60;
    const { token: refreshToken } = generateToken(user, refreshTokenExp, ETokenType.REFRESH);

    user.refreshToken = refreshToken;
    user.save();

    const userLogout = await RefreshToken.findOne({ user_id: user._id });
    if (!userLogout) {
      await new RefreshToken({
        user_id: user._id,
        token: refreshToken,
      }).save();
    }

    return { token: { accessToken, refreshToken }, user };
  }

  public async refreshToken(tokenData: RefreshTokenDto): Promise<{ token: string }> {
    const { refreshToken } = tokenData;
    const { id, type } = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET!) as DataStoredInToken;

    if (type !== ETokenType.REFRESH) {
      throw new HttpException(HTTP_STATUS.FORBIDDEN, 'Access permission denied!');
    }

    const findUser = await User.findById(id);
    if (!findUser) {
      throw new HttpException(HTTP_STATUS.CONFLICT, `This user ${id} was not found`);
    }

    if (findUser.isActive === false) {
      throw new HttpException(HTTP_STATUS.CONFLICT, `This user ${id} was not active`);
    }

    const accessTokenExp = 60 * 60;
    const { token } = generateToken(findUser, accessTokenExp, ETokenType.REFRESH);

    return { token };
  }

  public async signout(id: string): Promise<any> {
    const result = await RefreshToken.deleteMany({
      user_id: id,
    });
    if (!result) {
      throw new HttpException(HTTP_STATUS.BAD_REQUEST, `User with id ${id} has been logged out `);
    }
    return `Logged out user id ${id}`;
  }
}
