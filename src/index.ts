import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import 'reflect-metadata';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';
import bodyParser from 'body-parser';

import { HOST_NAME, NODE_ENV, connectDB } from './configs';
import { API } from './constants';
import { defaultErrorHandler } from './middlewares';
import route from './routes';
import { logger } from './utils/logger';

dotenv.config();
const app = express();

const PORT = process.env.PORT || 5000;

connectDB()
  .then(connect => {
    logger.info(`Database connected: , ${connect.connection.host} ${connect.connection.name}`);
  })
  .catch(e => logger.error(e));

app.use(cors());
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(route);

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Organic Food Specification',
      version: '1.0.0',
      description: 'Organic Food API Specification, website for organic food model',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    servers: [{ url: API }],
  },
  apis: ['src/routes/*.ts', 'src/models/schema/*.ts', 'src/dtos/*.ts'],
};
const specs = swaggerJSDoc(options);
app.use('/api-documentation', swaggerUI.serve, swaggerUI.setup(specs));

app.use(defaultErrorHandler);

app.listen(PORT, () => {
  logger.info(`=================================`);
  logger.info(`======= ENV: ${NODE_ENV || 'development'} =======`);
  logger.info(`🚀 App listening on http://${HOST_NAME}:${PORT}${API}`);
  logger.info(`🚀 API Spec http://${HOST_NAME}:${PORT}/api-documentation`);
  logger.info(`=================================`);
});
